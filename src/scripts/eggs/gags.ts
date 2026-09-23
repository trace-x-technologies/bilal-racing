/**
 * Typed-word gags.
 *  - "meow": the driver peeks up from the bottom edge ("mrrp?").
 *  - "box":  a cardboard box drops in, the cat sprints over and hops in.
 */
import { driver } from '@/data/lore';
import { sound } from '@/scripts/audio';
import { EASE_IN, EASE_OUT_BACK, EASE_OUT_EXPO, foundEgg, play, reduced, toast, wait } from './util';

export interface GagControl {
  meow(): void;
  box(): void;
}

export function initGags(root: HTMLElement): GagControl {
  const peek = root.querySelector<HTMLElement>('[data-peek]');
  const stage = root.querySelector<HTMLElement>('[data-box]');
  let peekBusy = false;
  let boxBusy = false;

  async function meow(): Promise<void> {
    sound.play('meow');
    toast('Poosa heard you.', 'gold');
    foundEgg('meow', 'Meow detected on the radio');
    if (!peek || peekBusy) return;
    peekBusy = true;
    const head = peek.querySelector<HTMLElement>('.peek-head');
    const bubble = peek.querySelector<HTMLElement>('.peek-bubble');
    peek.hidden = false;
    try {
      if (reduced()) {
        await play(peek, [{ opacity: 0 }, { opacity: 1 }], { duration: 200, fill: 'forwards' });
        await wait(2200);
        await play(peek, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' });
      } else {
        await play(head, [{ transform: 'translateY(105%)' }, { transform: 'translateY(0)' }], {
          duration: 620,
          easing: EASE_OUT_BACK,
          fill: 'both',
        });
        peek.classList.add('is-up');
        void play(bubble, [{ opacity: 0, transform: 'scale(0.3) rotate(12deg)' }, { opacity: 1, transform: 'scale(1) rotate(6deg)' }], {
          duration: 420,
          easing: EASE_OUT_BACK,
          fill: 'both',
        });
        await wait(1900);
        peek.classList.remove('is-up');
        void play(bubble, [{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'forwards' });
        await play(head, [{ transform: 'translateY(0)' }, { transform: 'translateY(110%)' }], {
          duration: 380,
          easing: EASE_IN,
          fill: 'forwards',
        });
      }
    } finally {
      peek.hidden = true;
      peek.getAnimations({ subtree: true }).forEach((a) => a.cancel());
      peekBusy = false;
    }
  }

  async function box(): Promise<void> {
    sound.play('radio');
    toast(driver.radioCatchphrase, 'gold');
    foundEgg('box', 'Box, box');
    if (!stage || boxBusy) return;
    boxBusy = true;
    const body = stage.querySelector<HTMLElement>('.box-body');
    const cat = stage.querySelector<HTMLElement>('.box-cat');
    const dust = stage.querySelector<HTMLElement>('.box-dust');
    stage.classList.remove('is-landed');
    stage.hidden = false;
    try {
      if (reduced()) {
        stage.classList.add('is-landed');
        await play(stage, [{ opacity: 0 }, { opacity: 1 }], { duration: 240, fill: 'forwards' });
        await wait(4200);
        await play(stage, [{ opacity: 1 }, { opacity: 0 }], { duration: 240, fill: 'forwards' });
        return;
      }

      sound.play('whoosh');
      await play(
        body,
        [
          { transform: 'translateY(-115vh) rotate(-10deg)' },
          { transform: 'translateY(0) rotate(0deg)' },
        ],
        { duration: 640, easing: EASE_IN, fill: 'backwards' },
      );
      void play(
        dust,
        [
          { opacity: 0.9, transform: 'scaleX(0.4)' },
          { opacity: 0, transform: 'scaleX(1.5) translateY(-6px)' },
        ],
        { duration: 620, easing: EASE_OUT_EXPO },
      );
      await play(
        body,
        [
          { transform: 'scale(1.16, 0.82)' },
          { transform: 'scale(0.94, 1.07)', offset: 0.45 },
          { transform: 'scale(1.02, 0.98)', offset: 0.75 },
          { transform: 'none' },
        ],
        { duration: 440, easing: 'ease-out' },
      );

      // Enter the driver: flat out along the floor, then a hop into the box.
      await play(
        cat,
        [
          { transform: 'translate(300px, 16px) rotate(0deg)', opacity: 1 },
          { transform: 'translate(150px, 12px) rotate(-4deg)', offset: 0.34 },
          { transform: 'translate(110px, 16px) scale(1.06, 0.9)', offset: 0.44 },
          { transform: 'translate(64px, -92px) rotate(-14deg)', offset: 0.66 },
          { transform: 'translate(6px, -46px) rotate(-4deg)', offset: 0.84 },
          { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
        ],
        { duration: 1050, easing: 'cubic-bezier(0.35, 0.1, 0.3, 1)', fill: 'both' },
      );
      stage.classList.add('is-landed');
      void play(
        body,
        [
          { transform: 'rotate(0deg)' },
          { transform: 'rotate(-4deg)' },
          { transform: 'rotate(3deg)' },
          { transform: 'rotate(-2deg)' },
          { transform: 'rotate(0deg)' },
        ],
        { duration: 620, easing: 'ease-in-out' },
      );
      await wait(3600);
      // Pit exit.
      await play(stage, [{ transform: 'none' }, { transform: 'translateX(24rem) rotate(6deg)' }], {
        duration: 720,
        easing: EASE_IN,
        fill: 'forwards',
      });
    } finally {
      stage.hidden = true;
      stage.classList.remove('is-landed');
      stage.getAnimations({ subtree: true }).forEach((a) => a.cancel());
      boxBusy = false;
    }
  }

  return {
    meow: () => void meow(),
    box: () => void box(),
  };
}
