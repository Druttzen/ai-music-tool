// Generated from the Python FastAPI OpenAPI contract. Do not edit by hand.
// Regenerate: npm run contracts:sidecar

export type AceStepEnsureResult = {
  "ok": boolean;
  "url": string;
};

export type AceStepPresetCatalog = {
  "home": string;
  "note": string;
  "quality_available": boolean;
  "quality_model": string;
  "sft_available"?: boolean;
  "sft_model"?: string;
  "turbo_model": string;
};

export type AcousticBrainzResponse = {
  "bpm"?: number | null;
  "danceability"?: number | null;
  "danceability_prob"?: number | null;
  "genres"?: Array<string>;
  "key_key"?: string | null;
  "key_scale"?: string | null;
  "key_strength"?: number | null;
  "loudness"?: number | null;
  "moods"?: Array<string>;
  "provider": string;
  "recording_mbid": string;
  "voice_instrumental"?: number | null;
};

export type Analysis = {
  "beat_count": number;
  "beat_density": number;
  "device": string;
  "duration_sec": number;
  "genre_model"?: string | null;
  "genre_predictions"?: Array<GenrePrediction> | null;
  "harmonic_ratio": number;
  "key_confidence": number;
  "key_estimate": string;
  "onset_strength": number;
  "percussive_ratio": number;
  "spectral_bandwidth_hz": number;
  "spectral_centroid_hz": number;
  "spectral_rolloff_hz": number;
  "tempo_bpm": number;
};

export type Body_analyze_analyze_post = {
  "file": string;
};

export type Body_analyze_image_analyze_image_post = {
  "caption"?: boolean;
  "clip_tags"?: boolean;
  "file": string;
};

export type Body_enqueue_generate_drafts_generate_drafts_jobs_post = {
  "candidate_count"?: number;
  "cfg_coef"?: number;
  "condition_melody"?: boolean;
  "duration_sec"?: number;
  "model"?: string;
  "prompt": string;
  "reference"?: string | null;
  "seed"?: number | null;
  "temperature"?: number;
  "top_k"?: number;
  "top_p"?: number;
};

export type Body_enqueue_generate_melody_generate_melody_jobs_post = {
  "cfg_coef"?: number | null;
  "duration_sec"?: number;
  "melody": string;
  "model"?: string | null;
  "prompt": string;
  "seed"?: number | null;
  "temperature"?: number | null;
  "top_k"?: number | null;
  "top_p"?: number | null;
};

export type Body_generate_cover_ref_cover_ref_post = {
  "height"?: number;
  "image": string;
  "num_inference_steps"?: number;
  "prompt": string;
  "seed"?: number | null;
  "strength"?: number;
  "width"?: number;
};

export type Body_generate_music_with_melody_generate_melody_post = {
  "cfg_coef"?: number | null;
  "duration_sec"?: number;
  "melody": string;
  "prompt": string;
  "seed"?: number | null;
  "temperature"?: number | null;
  "top_k"?: number | null;
  "top_p"?: number | null;
};

export type Body_separate_separate_post = {
  "file": string;
  "model_name"?: string;
};

export type Body_sonic_signature_sonic_signature_post = {
  "file": string;
};

export type Body_vocal_embed_align_preview_vocal_embed_align_preview_post = {
  "guide_vocal": string;
  "plan_json": string;
};

export type Body_vocal_embed_ds_export_vocal_embed_ds_export_post = {
  "guide_vocal"?: string | null;
  "plan_json": string;
};

export type Body_vocal_embed_synthesize_vocal_embed_synthesize_post = {
  "guide_vocal"?: string | null;
  "instrumental": string;
  "plan_json": string;
};

export type Body_vocal_transform_mix_vocal_transform_post = {
  "file": string;
  "formant_shift"?: number;
  "mode"?: string;
  "output"?: string;
  "pitch_semitones"?: number;
  "regions_json"?: string;
};

export type CapabilityContract = {
  "available": boolean;
  "commercial_use": boolean;
  "id": string;
  "install_hint": string;
  "license": string;
  "prompt_install"?: boolean;
  "tasks": Array<string>;
  "title": string;
};

export type ChordPoint = {
  "chord": string;
  "strength": number;
  "time_sec": number;
};

export type CoverRequest = {
  "height"?: number;
  "num_inference_steps"?: number;
  "prompt": string;
  "seed"?: number | null;
  "width"?: number;
};

export type DeviceInfo = {
  "backend": string;
  "cuda_version"?: string | null;
  "device": string;
  "name": string;
  "torch_available": boolean;
  "torch_version"?: string | null;
  "total_vram_gb": number;
};

export type DraftCandidate = {
  "index": number;
  "prompt_score": number | null;
  "reference_score": number | null;
  "score": number | null;
  "seed": number;
};

export type DraftSearchResult = {
  "candidates": Array<DraftCandidate>;
  "note": string;
  "ranked": boolean;
  "ranker": string | null;
  "reference_used": boolean;
  "selected_index": number;
};

export type FailSafeCapabilities = {
  "fix_push_available": boolean;
  "maintainer_mode": boolean;
  "repo_root": string;
  "runtime_deliver_available": boolean;
};

export type FixPushRequest = {
  "github_token"?: string | null;
  "mode"?: "local" | "cloud";
};

export type FixPushResponse = {
  "branch"?: string | null;
  "changed"?: boolean | null;
  "commit"?: string | null;
  "message": string;
  "ok": boolean;
  "pr_url"?: string | null;
  "stage": string;
  "workflow_url"?: string | null;
};

export type GenerateRequest = {
  "cfg_coef"?: number | null;
  "duration_sec"?: number;
  "model"?: string | null;
  "prompt": string;
  "seed"?: number | null;
  "temperature"?: number | null;
  "top_k"?: number | null;
  "top_p"?: number | null;
};

export type GenerateSongRequest = {
  "audio_format"?: string;
  "bpm"?: number | null;
  "duration_sec"?: number | null;
  "guidance_scale"?: number | null;
  "inference_steps"?: number | null;
  "key_scale"?: string;
  "lyrics"?: string;
  "model"?: string;
  "prompt": string;
  "seed"?: number | null;
  "thinking"?: boolean;
  "vocal_language"?: string;
};

export type GenrePrediction = {
  "label": string;
  "score": number;
};

export type HTTPValidationError = {
  "detail"?: Array<ValidationError>;
};

export type Health = {
  "acestep_available"?: boolean;
  "capabilities"?: Array<CapabilityContract> | null;
  "cover_available"?: boolean;
  "cover_ref_available"?: boolean;
  "device": string;
  "device_info"?: DeviceInfo | null;
  "fix_push_available"?: boolean;
  "generate_available": boolean;
  "genre_available": boolean;
  "librosa_available"?: boolean;
  "maintainer_mode"?: boolean;
  "owned"?: boolean;
  "policy"?: Record<string, unknown> | null;
  "status": string;
  "stems_available": boolean;
  "stems_melband_available"?: boolean;
  "version": string;
  "vision_available": boolean;
  "vocal_diffsinger_available": boolean;
  "vocal_embed_plan_available": boolean;
  "vocal_ml_available": boolean;
  "vocal_models_available": boolean;
  "vocal_rvc_available": boolean;
  "vocal_synthesis_available": boolean;
  "vocal_transform_available"?: boolean;
};

export type ImageAnalysis = {
  "caption"?: string | null;
  "caption_model"?: string | null;
  "clip_model"?: string | null;
  "clip_tags"?: Array<GenrePrediction> | null;
  "device": string;
};

export type JobCancelResponse = {
  "job_id": string;
  "status": "queued" | "running" | "cancellation_requested" | "done" | "error" | "cancelled";
};

export type JobSubmission = {
  "job_id": string;
};

export type OpenVpiStatus = {
  "acoustic_exp": string | null;
  "configured": boolean;
  "language": string | null;
  "python": string | null;
  "ready": boolean;
  "root": string | null;
  "speaker": string | null;
  "variance_exp": string | null;
};

export type OpenvpiDsExportResponse = {
  "align_method": string | null;
  "format": string;
  "segment_count": number;
  "segments": Array<Record<string, string | number>>;
  "version": number;
};

export type PublicAudioResult = {
  "audio_format": string | null;
  "duration_sec": number | null;
  "mode": string | null;
  "model": string | null;
  "ready": boolean;
};

export type PublicJobStatus = {
  "error": string | null;
  "job_id": string;
  "kind": string;
  "message": string;
  "progress": number;
  "result": PublicAudioResult;
  "status": "queued" | "running" | "cancellation_requested" | "done" | "error" | "cancelled";
};

export type RuntimeDeliverRequest = {
  "github_token"?: string | null;
  "mode"?: "issue" | "branch" | "pr";
  "payload"?: Record<string, unknown>;
};

export type RuntimeDeliverResponse = {
  "branch"?: string | null;
  "commit"?: string | null;
  "issue_number"?: number | null;
  "issue_url"?: string | null;
  "message": string;
  "ok": boolean;
  "pr_url"?: string | null;
  "stage": string;
};

export type SeparateResult = {
  "device": string;
  "job_id": string;
  "model": string;
  "sources": Array<string>;
  "stems": Array<StemFile>;
};

export type SonicSignatureResponse = {
  "beat_count": number;
  "chord_progression": Array<ChordPoint>;
  "duration_sec": number;
  "harmonic_ratio": number;
  "key_confidence": number;
  "key_estimate": string;
  "loudness_db": number;
  "percussive_ratio": number;
  "provider": string;
  "spectral_centroid_hz": number;
  "tempo_bpm": number;
  "time_signature": number;
  "timeline_segments": Array<TimelineSegment>;
};

export type StemFile = {
  "download_url": string;
  "filename": string;
  "name": string;
};

export type TimelineSegment = {
  "brightness_hz": number;
  "end_sec": number;
  "energy": number;
  "start_sec": number;
};

export type ValidationError = {
  "ctx"?: Record<string, unknown>;
  "input"?: unknown;
  "loc": Array<string | number>;
  "msg": string;
  "type": string;
};

export type VocalAlignPreviewResponse = {
  "align_method": string;
  "mfa_configured": boolean;
  "mfa_ready": boolean;
  "sections": Array<Record<string, unknown>>;
  "word_count": number;
};

export type VocalAlignStatus = {
  "mfa_configured": boolean;
  "mfa_ready": boolean;
};

export type VocalEmbedPlanEnvelope = {
  "createdAt": string;
  "kind": string;
  "openvpiDs"?: Record<string, unknown> | null;
  "plan": Record<string, unknown>;
  "version": number;
};

export type VocalEmbedPlanResponse = {
  "align_method"?: string | null;
  "align_word_count"?: number | null;
  "message": string;
  "mode": string;
  "next_steps"?: Array<string>;
  "ok": boolean;
  "openvpi_ds_segments"?: number;
  "section_count": number;
  "stage": string;
  "synthesis_available"?: boolean;
};

export type VocalModelStatus = {
  "align": VocalAlignStatus;
  "diffsinger_cmd": string | null;
  "diffsinger_configured": boolean;
  "diffsinger_model_dir": string | null;
  "diffsinger_openvpi": OpenVpiStatus;
  "diffsinger_ready": boolean;
  "diffsinger_url": string | null;
  "models_ready": boolean;
  "rvc_api": boolean;
  "rvc_api_url": string | null;
  "rvc_index": string | null;
  "rvc_model": string | null;
  "rvc_model_configured": boolean;
  "rvc_models_dir": string | null;
  "rvc_python": boolean;
  "rvc_ready": boolean;
  "transformers_tts": boolean;
};

export type YoutubeResolveRequest = {
  "url": string;
};

export type YoutubeResolveResponse = {
  "author_name": string;
  "categories"?: Array<string>;
  "description_excerpt"?: string;
  "duration_sec"?: number | null;
  "parsed_artist": string;
  "parsed_track": string;
  "provider": string;
  "search_query": string;
  "tags"?: Array<string>;
  "thumbnail_url": string;
  "title": string;
  "video_id": string;
  "watch_url": string;
};

export type YoutubeSonicRequest = {
  "url": string;
};
