export class StoryRunner {
  constructor({
    story,
    handlers,
    ctx,
    progress
  }) {
    this.story = story;
    this.handlers = handlers;
    this.ctx = ctx;
    this.progress = progress;
  }
  async run() {
    const {
      ctx
    } = this;
    for (const beat of this.story.beats) {
      if (ctx.exited) return;
      if (this.story.forbidClips && beat.clip && this.story.forbidClips.includes(beat.clip)) throw new Error(`story "${this.story.id}" may not use clip ${beat.clip}`);
      const h = this.handlers[beat.type];
      if (!h) throw new Error(`no handler for beat type ${beat.type}`);
      this.progress?.set(beat.seg);
      ctx.log.log('beat_start', {
        beat: beat.id,
        seg: beat.seg
      });
      document.body.dataset.beat = beat.id;
      await h(beat, ctx);
    }
  }
}
