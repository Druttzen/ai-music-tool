//! Minimal audio-only AAC-LC → M4A (ISOBMFF) muxer.
//!
//! `mp4e` requires a video track for `moov`, so Studio ships a small writer:
//! `ftyp` + `moov` + `mdat` with raw AAC access units (no ADTS).

use anyhow::{anyhow, Result};
use rusty_aac::audio_specific_config_bytes;

const SAMPLES_PER_FRAME: u32 = 1024;

fn push_u16(out: &mut Vec<u8>, v: u16) {
    out.extend_from_slice(&v.to_be_bytes());
}

fn push_u32(out: &mut Vec<u8>, v: u32) {
    out.extend_from_slice(&v.to_be_bytes());
}

fn push_box(out: &mut Vec<u8>, typ: &[u8; 4], body: impl FnOnce(&mut Vec<u8>)) {
    let start = out.len();
    out.extend_from_slice(&[0, 0, 0, 0]);
    out.extend_from_slice(typ);
    body(out);
    let size = (out.len() - start) as u32;
    out[start..start + 4].copy_from_slice(&size.to_be_bytes());
}

fn push_full_box(
    out: &mut Vec<u8>,
    typ: &[u8; 4],
    version_flags: u32,
    body: impl FnOnce(&mut Vec<u8>),
) {
    push_box(out, typ, |o| {
        push_u32(o, version_flags);
        body(o);
    });
}

fn build_esds(asc: &[u8], max_bitrate: u32) -> Vec<u8> {
    let mut es = Vec::new();
    es.push(0x03);
    let es_len_pos = es.len();
    es.push(0);
    push_u16(&mut es, 1);
    es.push(0);

    es.push(0x04);
    let dc_len_pos = es.len();
    es.push(0);
    es.push(0x40);
    es.push(0x15);
    es.extend_from_slice(&[0, 0, 0]);
    push_u32(&mut es, max_bitrate);
    push_u32(&mut es, max_bitrate);
    es.push(0x05);
    es.push(asc.len() as u8);
    es.extend_from_slice(asc);
    es[dc_len_pos] = (es.len() - dc_len_pos - 1) as u8;

    es.push(0x06);
    es.push(1);
    es.push(2);
    es[es_len_pos] = (es.len() - es_len_pos - 1) as u8;

    let mut body = Vec::new();
    push_u32(&mut body, 0);
    body.extend_from_slice(&es);
    body
}

/// Mux raw AAC-LC frames into an audio-only `.m4a` byte stream.
pub fn mux_aac_lc_m4a(
    frames: &[Vec<u8>],
    sample_rate: u32,
    channels: u32,
    bitrate_bps: u32,
) -> Result<Vec<u8>> {
    if frames.is_empty() {
        return Err(anyhow!("m4a mux requires at least one AAC frame"));
    }
    if !(1..=2).contains(&channels) {
        return Err(anyhow!("m4a mux requires mono or stereo"));
    }

    let n = frames.len() as u32;
    let duration = n.saturating_mul(SAMPLES_PER_FRAME);
    let asc = audio_specific_config_bytes(sample_rate, channels as u16);
    if asc.is_empty() {
        return Err(anyhow!("failed to build AudioSpecificConfig"));
    }
    let bitrate = bitrate_bps.max(64_000);

    let mut ftyp = Vec::new();
    push_box(&mut ftyp, b"ftyp", |o| {
        o.extend_from_slice(b"M4A ");
        push_u32(o, 0);
        o.extend_from_slice(b"M4A ");
        o.extend_from_slice(b"mp42");
        o.extend_from_slice(b"isom");
    });

    let mut moov = Vec::new();
    push_box(&mut moov, b"moov", |moov| {
        push_full_box(moov, b"mvhd", 0, |o| {
            push_u32(o, 0);
            push_u32(o, 0);
            push_u32(o, sample_rate);
            push_u32(o, duration);
            push_u32(o, 0x0001_0000);
            push_u16(o, 0x0100);
            o.extend_from_slice(&[0u8; 10]);
            o.extend_from_slice(&[
                0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00, 0x40, 0x00, 0x00, 0x00,
            ]);
            o.extend_from_slice(&[0u8; 24]);
            push_u32(o, 2);
        });

        push_box(moov, b"trak", |trak| {
            push_full_box(trak, b"tkhd", 0x0000_0003, |o| {
                push_u32(o, 0);
                push_u32(o, 0);
                push_u32(o, 1);
                push_u32(o, 0);
                push_u32(o, duration);
                o.extend_from_slice(&[0u8; 8]);
                push_u16(o, 0);
                push_u16(o, 0);
                push_u16(o, 0x0100);
                push_u16(o, 0);
                o.extend_from_slice(&[
                    0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                    0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x40, 0x00, 0x00, 0x00,
                ]);
                push_u32(o, 0);
                push_u32(o, 0);
            });

            push_box(trak, b"mdia", |mdia| {
                push_full_box(mdia, b"mdhd", 0, |o| {
                    push_u32(o, 0);
                    push_u32(o, 0);
                    push_u32(o, sample_rate);
                    push_u32(o, duration);
                    push_u16(o, 0x55c4);
                    push_u16(o, 0);
                });
                push_full_box(mdia, b"hdlr", 0, |o| {
                    push_u32(o, 0);
                    o.extend_from_slice(b"soun");
                    o.extend_from_slice(&[0u8; 12]);
                    o.extend_from_slice(b"SoundHandler\0");
                });
                push_box(mdia, b"minf", |minf| {
                    push_full_box(minf, b"smhd", 0, |o| {
                        push_u16(o, 0);
                        push_u16(o, 0);
                    });
                    push_box(minf, b"dinf", |dinf| {
                        push_full_box(dinf, b"dref", 0, |o| {
                            push_u32(o, 1);
                            push_full_box(o, b"url ", 1, |_| {});
                        });
                    });
                    push_box(minf, b"stbl", |stbl| {
                        push_full_box(stbl, b"stsd", 0, |o| {
                            push_u32(o, 1);
                            push_box(o, b"mp4a", |mp4a| {
                                mp4a.extend_from_slice(&[0u8; 6]);
                                push_u16(mp4a, 1);
                                mp4a.extend_from_slice(&[0u8; 8]);
                                push_u16(mp4a, channels as u16);
                                push_u16(mp4a, 16);
                                push_u16(mp4a, 0);
                                push_u16(mp4a, 0);
                                push_u32(mp4a, sample_rate.min(0xFFFF) << 16);
                                let esds = build_esds(&asc, bitrate);
                                push_box(mp4a, b"esds", |e| e.extend_from_slice(&esds));
                            });
                        });
                        push_full_box(stbl, b"stts", 0, |o| {
                            push_u32(o, 1);
                            push_u32(o, n);
                            push_u32(o, SAMPLES_PER_FRAME);
                        });
                        push_full_box(stbl, b"stsc", 0, |o| {
                            push_u32(o, 1);
                            push_u32(o, 1);
                            push_u32(o, n);
                            push_u32(o, 1);
                        });
                        push_full_box(stbl, b"stsz", 0, |o| {
                            push_u32(o, 0);
                            push_u32(o, n);
                            for f in frames {
                                push_u32(o, f.len() as u32);
                            }
                        });
                        push_full_box(stbl, b"stco", 0, |o| {
                            push_u32(o, 1);
                            push_u32(o, 0);
                        });
                    });
                });
            });
        });
    });

    let stco_tag = moov
        .windows(4)
        .rposition(|w| w == b"stco")
        .ok_or_else(|| anyhow!("m4a mux missing stco"))?;
    let chunk_offset_pos = stco_tag + 4 + 4 + 4;
    let mdat_payload: usize = frames.iter().map(|f| f.len()).sum();
    let mdat_size = 8 + mdat_payload;
    let mdat_data_offset = (ftyp.len() + moov.len() + 8) as u32;
    moov[chunk_offset_pos..chunk_offset_pos + 4].copy_from_slice(&mdat_data_offset.to_be_bytes());

    let mut out = Vec::with_capacity(ftyp.len() + moov.len() + mdat_size);
    out.extend_from_slice(&ftyp);
    out.extend_from_slice(&moov);
    push_u32(&mut out, mdat_size as u32);
    out.extend_from_slice(b"mdat");
    for f in frames {
        out.extend_from_slice(f);
    }
    Ok(out)
}
