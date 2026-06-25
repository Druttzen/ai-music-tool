//! Decode encoded audio bytes to interleaved f32 via symphonia.

use std::io::Cursor;

use anyhow::{anyhow, Context, Result};
use symphonia::core::audio::SampleBuffer;
use symphonia::core::codecs::{DecoderOptions, CODEC_TYPE_NULL};
use symphonia::core::errors::Error as SymphoniaError;
use symphonia::core::formats::FormatOptions;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;

/// Decode arbitrary audio bytes (MP3/M4A/OGG/FLAC/WAV) into interleaved f32.
pub fn decode_interleaved(bytes: Vec<u8>) -> Result<(Vec<f32>, u32, u32)> {
    let mss = MediaSourceStream::new(Box::new(Cursor::new(bytes)), Default::default());
    let probed = symphonia::default::get_probe()
        .format(
            &Hint::new(),
            mss,
            &FormatOptions::default(),
            &MetadataOptions::default(),
        )
        .context("probing audio format")?;

    let mut format = probed.format;
    let track = format
        .tracks()
        .iter()
        .find(|t| t.codec_params.codec != CODEC_TYPE_NULL)
        .ok_or_else(|| anyhow!("no decodable audio track"))?;
    let track_id = track.id;

    let mut decoder = symphonia::default::get_codecs()
        .make(&track.codec_params, &DecoderOptions::default())
        .context("creating decoder")?;

    let mut samples: Vec<f32> = Vec::new();
    let mut channels = 0u32;
    let mut sample_rate = 0u32;
    let mut sbuf: Option<SampleBuffer<f32>> = None;

    loop {
        let packet = match format.next_packet() {
            Ok(p) => p,
            Err(SymphoniaError::IoError(ref e))
                if e.kind() == std::io::ErrorKind::UnexpectedEof =>
            {
                break;
            }
            Err(SymphoniaError::ResetRequired) => break,
            Err(e) => return Err(e).context("reading packet"),
        };

        if packet.track_id() != track_id {
            continue;
        }

        match decoder.decode(&packet) {
            Ok(decoded) => {
                let spec = *decoded.spec();
                if sample_rate == 0 {
                    sample_rate = spec.rate;
                    channels = spec.channels.count() as u32;
                }
                if sbuf.is_none() {
                    sbuf = Some(SampleBuffer::<f32>::new(decoded.capacity() as u64, spec));
                }
                if let Some(buf) = sbuf.as_mut() {
                    buf.copy_interleaved_ref(decoded);
                    samples.extend_from_slice(buf.samples());
                }
            }
            Err(SymphoniaError::DecodeError(_)) => continue,
            Err(e) => return Err(e).context("decoding packet"),
        }
    }

    if sample_rate == 0 || channels == 0 {
        return Err(anyhow!("decoded no audio frames"));
    }
    Ok((samples, channels, sample_rate))
}

/// Up-mix mono interleaved samples to stereo.
pub fn to_stereo_interleaved(samples: Vec<f32>, channels: u32) -> (Vec<f32>, u32) {
    if channels >= 2 {
        return (samples, channels);
    }
    let frames = samples.len();
    let mut stereo = Vec::with_capacity(frames * 2);
    for s in samples {
        stereo.push(s);
        stereo.push(s);
    }
    (stereo, 2)
}

/// Slice interleaved audio to [start_sec, end_sec).
pub fn slice_interleaved(
    samples: &[f32],
    channels: u32,
    sample_rate: u32,
    start_sec: f64,
    end_sec: f64,
) -> Vec<f32> {
    let ch = channels.max(1) as usize;
    let sr = sample_rate.max(1) as usize;
    let frames = samples.len() / ch;
    let start = (start_sec.max(0.0) * sr as f64).floor() as usize;
    let end = (end_sec.max(start_sec + 0.5) * sr as f64).ceil() as usize;
    let end = end.min(frames);
    let start = start.min(end);
    samples[start * ch..end * ch].to_vec()
}
