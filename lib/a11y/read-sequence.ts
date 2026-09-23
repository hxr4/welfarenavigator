export interface Segment {
  id: string;
  text: string;
  clip?: string;
}

export interface SegmentEvents {
  onStart: () => void;
  onEnd: () => void;
  onError: () => void;
}

export interface SegmentPlayer {
  available: (seg: Segment) => boolean;
  play: (seg: Segment, ev: SegmentEvents) => () => void;
}

export interface ReadState {
  playing: boolean;
  speakingId: string | null;
  unavailable: boolean;
}

export const IDLE: ReadState = { playing: false, speakingId: null, unavailable: false };

export class ReadSequence {
  private run = 0;
  private cancel: (() => void) | null = null;
  state: ReadState = IDLE;

  constructor(
    private player: SegmentPlayer,
    private onChange: (s: ReadState) => void,
  ) {}

  private set(s: ReadState) {
    this.state = s;
    this.onChange(s);
  }

  start(segments: Segment[]) {
    this.stop();
    const playable = segments.filter((s) => this.player.available(s));
    if (playable.length === 0) {
      this.set({ playing: false, speakingId: null, unavailable: true });
      return;
    }
    const run = ++this.run;
    const queue = [...playable];
    this.set({ playing: true, speakingId: null, unavailable: false });
    const next = () => {
      if (run !== this.run) return;
      const seg = queue.shift();
      if (!seg) {
        this.cancel = null;
        this.set({ playing: false, speakingId: null, unavailable: false });
        return;
      }
      let finished = false;
      const done = () => {
        if (finished || run !== this.run) return;
        finished = true;
        this.set({ ...this.state, speakingId: null });
        next();
      };
      this.cancel = this.player.play(seg, {
        onStart: () => {
          if (run !== this.run || finished) return;
          this.set({ playing: true, speakingId: seg.id, unavailable: false });
        },
        onEnd: done,
        onError: done,
      });
    };
    next();
  }

  stop() {
    this.run++;
    const c = this.cancel;
    this.cancel = null;
    c?.();
    if (this.state.playing || this.state.speakingId) this.set({ ...this.state, playing: false, speakingId: null });
  }
}
