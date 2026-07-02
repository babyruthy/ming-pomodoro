import { Quote } from '../types';

export const FOCUS_QUOTES: Quote[] = [
  { text: "Focus is a muscle, and you are building it right now.", author: "Unknown" },
  { text: "Your mind is for having ideas, not holding them.", author: "David Allen" },
  { text: "Only the focused mind can make things happen.", author: "Deepak Chopra" },
  { text: "Do not wait for extraordinary circumstances to do good action; try to use ordinary situations.", author: "Charles Kingsley" },
  { text: "The successful warrior is the average man, with laser-like focus.", author: "Bruce Lee" },
  { text: "Deep work is the superpower of the 21st century.", author: "Cal Newport" },
  { text: "One can have no smaller or greater mastery than mastery of oneself.", author: "Leonardo da Vinci" },
  { text: "Where your attention goes, your energy flows and life grows.", author: "Tony Robbins" },
  { text: "Great things are done by a series of small things brought together.", author: "Vincent Van Gogh" },
  { text: "The secret of change is to focus all of your energy, not on fighting the old, but on building the new.", author: "Socrates" }
];

export const BREAK_QUOTES: Quote[] = [
  { text: "Rest is not idleness, and to lie sometimes on the grass under trees... is by no means a waste of time.", author: "John Lubbock" },
  { text: "There is virtue in work and there is virtue in rest. Use both and overlook neither.", author: "Alan Cohen" },
  { text: "Take a deep breath. Let go of tension. Rest your eyes.", author: "Unknown" },
  { text: "Rest when you're weary. Refresh and renew yourself, your body, your mind, your spirit.", author: "Ralph Marston" },
  { text: "Your brain is consolidating the neural connections you just built. Enjoy the quiet.", author: "Neuroscience Fact" },
  { text: "Disconnect to reconnect.", author: "Unknown" },
  { text: "Step away from the screen, stretch, and drink some water.", author: "Self-Care Tip" },
  { text: "A break is not a halt in progress, it is the fuel for the next sprint.", author: "Unknown" }
];

export const FINISH_QUOTES: Quote[] = [
  { text: "Incredible work! You stayed true to your intentions.", author: "Praise" },
  { text: "Another brick in the temple of your long-term goals. Well done.", author: "Inspiration" },
  { text: "Slowing down is sometimes the fastest way to get where you want to be.", author: "Unknown" },
  { text: "You did it! Take a moment to appreciate your focus and self-discipline.", author: "Motivation" },
  { text: "Consistency is what transforms average into excellence.", author: "Unknown" }
];

export function getRandomQuote(category: 'focus' | 'break' | 'finish'): Quote {
  const list = category === 'focus' ? FOCUS_QUOTES : category === 'break' ? BREAK_QUOTES : FINISH_QUOTES;
  const index = Math.floor(Math.random() * list.length);
  return list[index];
}
