import { mediaBridge, releaseMedia } from "@/lib/captions/media";
import { filmstrip, peaksFromPcm, probeMedia } from "@/lib/captions/media-engine";
import { useStudio } from "@/lib/captions/store";
import { speechPcm } from "@/lib/captions/transcribe-client";

const PEAK_RATE = 50;

/** Attach a video/audio file to the studio: picture, metadata, waveform, filmstrip. */
export async function loadMediaFile(file: File) {
  const studio = useStudio.getState();
  releaseMedia();
  const url = URL.createObjectURL(file);
  mediaBridge.file = file;
  mediaBridge.url = url;
  const video = mediaBridge.video;
  if (video) {
    video.src = url;
    video.load();
  }
  const isAudio = file.type.startsWith("audio") || /\.(mp3|wav|m4a|aac|ogg|opus|flac)$/i.test(file.name);
  studio.setMedia({ duration: null, kind: isAudio ? "audio" : "video", name: file.name });
  studio.setMediaMeta(null);
  studio.setPeaks([], PEAK_RATE);
  studio.setThumbs([]);
  studio.selectSegment(null);
  studio.setNote(`${file.name} is loaded. Press Transcribe — Roman Urdu is selected by default.`);

  const info = await probeMedia(file);
  if (mediaBridge.file !== file) return;
  if (info) {
    mediaBridge.info = info;
    useStudio.getState().setMediaMeta({
      width: info.width,
      height: info.height,
      duration: info.duration,
      hasVideo: info.hasVideo,
      hasAudio: info.hasAudio,
      frameRate: info.frameRate,
    });
    if (!useStudio.getState().mediaDuration && info.duration) {
      useStudio.getState().setMedia({ duration: info.duration, kind: info.hasVideo ? "video" : "audio", name: file.name });
    }
  }

  // Waveform (and the cached voice track for transcription) in the background.
  if (!info || info.hasAudio) {
    void speechPcm()
      .then((pcm) => {
        if (mediaBridge.file !== file) return;
        useStudio.getState().setPeaks(peaksFromPcm(pcm, PEAK_RATE), PEAK_RATE);
      })
      .catch(() => {
        if (mediaBridge.file === file) useStudio.getState().setNote("Could not read the audio track for the waveform. Transcription may still work.");
      });
  }

  // Filmstrip thumbnails.
  if (info?.hasVideo) {
    const count = Math.min(90, Math.max(12, Math.round(info.duration / 1.5)));
    const thumbs: string[] = new Array(count).fill("");
    let pending = 0;
    void filmstrip(file, count, 72, (index, thumb) => {
      if (mediaBridge.file !== file) return;
      thumbs[index] = thumb;
      pending += 1;
      if (pending % 6 === 0 || index === count - 1) useStudio.getState().setThumbs([...thumbs]);
    })
      .then(() => {
        if (mediaBridge.file === file) useStudio.getState().setThumbs([...thumbs]);
      })
      .catch(() => undefined);
  }
}
