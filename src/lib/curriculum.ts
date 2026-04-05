export interface Technique {
  id: string;
  name: string;
  category: string;
  beltRank: string;
  stripe: number; // 1-4 for stripe requirements, 0 = belt promotion requirement
}

export interface BeltCurriculum {
  beltRank: string;
  label: string;
  color: string;
  techniques: Technique[];
}

const CATEGORIES = [
  "Escapes & Defenses",
  "Guard",
  "Passes",
  "Takedowns",
  "Submissions",
  "Sweeps",
  "Positional Control",
] as const;

export { CATEGORIES };

function t(
  id: string,
  name: string,
  category: string,
  beltRank: string,
  stripe: number
): Technique {
  return { id, name, category, beltRank, stripe };
}

// ─── WHITE BELT ──────────────────────────────────────────
const whiteBelt: Technique[] = [
  // Stripe 1 : Survival & Basic Positions
  t("w1-01", "Trap & Roll Escape from Mount", "Escapes & Defenses", "white", 1),
  t("w1-02", "Elbow-Knee Escape from Mount", "Escapes & Defenses", "white", 1),
  t("w1-03", "Bridge & Shrimp Drill", "Escapes & Defenses", "white", 1),
  t("w1-04", "Closed Guard Posture Control", "Guard", "white", 1),
  t("w1-05", "Closed Guard Hip Bump Sweep", "Sweeps", "white", 1),
  t("w1-06", "Standing in Closed Guard", "Passes", "white", 1),
  t("w1-07", "Basic Takedown : Body Lock", "Takedowns", "white", 1),
  t("w1-08", "Cross Collar Choke from Guard", "Submissions", "white", 1),
  t("w1-09", "Maintaining Mount", "Positional Control", "white", 1),
  t("w1-10", "Maintaining Side Control", "Positional Control", "white", 1),
  t("w1-11", "Basic Breakfall (back, side)", "Escapes & Defenses", "white", 1),
  t("w1-12", "Rear Naked Choke (basic)", "Submissions", "white", 1),

  // Stripe 2 : Guard Fundamentals
  t("w2-01", "Scissor Sweep from Closed Guard", "Sweeps", "white", 2),
  t("w2-02", "Armbar from Closed Guard", "Submissions", "white", 2),
  t("w2-03", "Triangle Choke from Closed Guard", "Submissions", "white", 2),
  t("w2-04", "Kimura from Closed Guard", "Submissions", "white", 2),
  t("w2-05", "Guillotine Choke (closed guard)", "Submissions", "white", 2),
  t("w2-06", "Side Control Escape : Shrimp to Guard", "Escapes & Defenses", "white", 2),
  t("w2-07", "Half Guard Recovery", "Guard", "white", 2),
  t("w2-08", "Double Leg Takedown", "Takedowns", "white", 2),
  t("w2-09", "Guard Pull to Closed Guard", "Takedowns", "white", 2),
  t("w2-10", "Knee on Belly Position", "Positional Control", "white", 2),
  t("w2-11", "Americana from Mount", "Submissions", "white", 2),
  t("w2-12", "Basic Guard Retention Concepts", "Guard", "white", 2),

  // Stripe 3 : Passing & Transitions
  t("w3-01", "Torreando Pass", "Passes", "white", 3),
  t("w3-02", "Knee Cut Pass", "Passes", "white", 3),
  t("w3-03", "Over-Under Pass", "Passes", "white", 3),
  t("w3-04", "Single Leg Takedown", "Takedowns", "white", 3),
  t("w3-05", "Arm Drag from Guard", "Guard", "white", 3),
  t("w3-06", "Pendulum Sweep", "Sweeps", "white", 3),
  t("w3-07", "Flower Sweep", "Sweeps", "white", 3),
  t("w3-08", "Ezekiel Choke from Mount", "Submissions", "white", 3),
  t("w3-09", "Back Mount Control (hooks & seatbelt)", "Positional Control", "white", 3),
  t("w3-10", "Turtle Escape : Sit Out", "Escapes & Defenses", "white", 3),
  t("w3-11", "North-South Position", "Positional Control", "white", 3),
  t("w3-12", "Headlock Escape (Kesa Gatame)", "Escapes & Defenses", "white", 3),

  // Stripe 4 : Combinations & Competition Prep
  t("w4-01", "Open Guard Basics (feet on hips)", "Guard", "white", 4),
  t("w4-02", "Butterfly Guard Sweep", "Sweeps", "white", 4),
  t("w4-03", "Omoplata from Guard", "Submissions", "white", 4),
  t("w4-04", "Armbar from Mount", "Submissions", "white", 4),
  t("w4-05", "Cross Choke from Mount", "Submissions", "white", 4),
  t("w4-06", "Back Take from Turtle", "Positional Control", "white", 4),
  t("w4-07", "Snap Down to Front Headlock", "Takedowns", "white", 4),
  t("w4-08", "Leg Drag Pass", "Passes", "white", 4),
  t("w4-09", "Triangle from Mount", "Submissions", "white", 4),
  t("w4-10", "Half Guard Underhook Sweep", "Sweeps", "white", 4),
  t("w4-11", "Submission Chain: Armbar → Triangle → Omoplata", "Submissions", "white", 4),
  t("w4-12", "Competition Rules & Etiquette", "Positional Control", "white", 4),
];

// ─── BLUE BELT ───────────────────────────────────────────
const blueBelt: Technique[] = [
  // Stripe 1 : Advanced Guard
  t("b1-01", "De La Riva Guard Basics", "Guard", "blue", 1),
  t("b1-02", "Spider Guard Control", "Guard", "blue", 1),
  t("b1-03", "Lasso Guard Sweep", "Sweeps", "blue", 1),
  t("b1-04", "X-Guard Entry & Sweep", "Sweeps", "blue", 1),
  t("b1-05", "Berimbolo Entry", "Sweeps", "blue", 1),
  t("b1-06", "Loop Choke from Half Guard", "Submissions", "blue", 1),
  t("b1-07", "Knee Shield Half Guard", "Guard", "blue", 1),
  t("b1-08", "Smash Pass", "Passes", "blue", 1),
  t("b1-09", "Body Lock Pass", "Passes", "blue", 1),
  t("b1-10", "Arm Triangle (Kata Gatame)", "Submissions", "blue", 1),
  t("b1-11", "Collar Drag Takedown", "Takedowns", "blue", 1),
  t("b1-12", "Guard Recovery from Half Guard Bottom", "Escapes & Defenses", "blue", 1),
  t("b1-13", "Backstep Pass", "Passes", "blue", 1),
  t("b1-14", "Ankle Pick Takedown", "Takedowns", "blue", 1),

  // Stripe 2 : No-Gi Fundamentals
  t("b2-01", "Guillotine Variations (arm-in, high elbow)", "Submissions", "blue", 2),
  t("b2-02", "D'Arce Choke", "Submissions", "blue", 2),
  t("b2-03", "Anaconda Choke", "Submissions", "blue", 2),
  t("b2-04", "No-Gi Guard Passing Concepts", "Passes", "blue", 2),
  t("b2-05", "Underhook Passing Series", "Passes", "blue", 2),
  t("b2-06", "Butterfly Guard in No-Gi", "Guard", "blue", 2),
  t("b2-07", "Single Leg X Guard", "Guard", "blue", 2),
  t("b2-08", "Wrestling Tie-Ups & Pummeling", "Takedowns", "blue", 2),
  t("b2-09", "Front Headlock Series", "Submissions", "blue", 2),
  t("b2-10", "Straight Ankle Lock", "Submissions", "blue", 2),
  t("b2-11", "Kimura Trap System", "Submissions", "blue", 2),
  t("b2-12", "Reverse Half Guard Pass", "Passes", "blue", 2),
  t("b2-13", "Duck Under Takedown", "Takedowns", "blue", 2),

  // Stripe 3 : Attacks from Top
  t("b3-01", "Paper Cutter Choke from Side Control", "Submissions", "blue", 3),
  t("b3-02", "Baseball Bat Choke", "Submissions", "blue", 3),
  t("b3-03", "North-South Choke", "Submissions", "blue", 3),
  t("b3-04", "Mounted Triangle", "Submissions", "blue", 3),
  t("b3-05", "Bow & Arrow Choke from Back", "Submissions", "blue", 3),
  t("b3-06", "Clock Choke from Turtle", "Submissions", "blue", 3),
  t("b3-07", "Crucifix Position & Attacks", "Positional Control", "blue", 3),
  t("b3-08", "Knee on Belly Attacks & Transitions", "Positional Control", "blue", 3),
  t("b3-09", "Back Control : Body Triangle", "Positional Control", "blue", 3),
  t("b3-10", "Mount Retention & Transitions", "Positional Control", "blue", 3),
  t("b3-11", "Float Pass", "Passes", "blue", 3),
  t("b3-12", "Long Step Pass", "Passes", "blue", 3),
  t("b3-13", "Wrist Lock from Multiple Positions", "Submissions", "blue", 3),

  // Stripe 4 : Competition & Combinations
  t("b4-01", "Submission Chains from Mount", "Submissions", "blue", 4),
  t("b4-02", "Submission Chains from Back", "Submissions", "blue", 4),
  t("b4-03", "Guard Passing Chains", "Passes", "blue", 4),
  t("b4-04", "Sweep to Submission Combos", "Sweeps", "blue", 4),
  t("b4-05", "Takedown to Guard Pass Sequences", "Takedowns", "blue", 4),
  t("b4-06", "Defensive Posture Under Pressure", "Escapes & Defenses", "blue", 4),
  t("b4-07", "Escaping Bad Positions Under Fatigue", "Escapes & Defenses", "blue", 4),
  t("b4-08", "Point Scoring Strategy", "Positional Control", "blue", 4),
  t("b4-09", "Advanced Guard Retention", "Guard", "blue", 4),
  t("b4-10", "Counter Attacking from Defense", "Escapes & Defenses", "blue", 4),
  t("b4-11", "Leg Entanglement Basics (ashi garami)", "Guard", "blue", 4),
  t("b4-12", "Competition Mindset & Match Planning", "Positional Control", "blue", 4),
];

// ─── PURPLE BELT ─────────────────────────────────────────
const purpleBelt: Technique[] = [
  // Stripe 1 : System Development
  t("p1-01", "Developing a Personal Guard Game", "Guard", "purple", 1),
  t("p1-02", "Deep Half Guard System", "Guard", "purple", 1),
  t("p1-03", "Reverse De La Riva Guard", "Guard", "purple", 1),
  t("p1-04", "50/50 Guard", "Guard", "purple", 1),
  t("p1-05", "Pressure Passing System", "Passes", "purple", 1),
  t("p1-06", "Heel Hook Defense & Fundamentals", "Escapes & Defenses", "purple", 1),
  t("p1-07", "Inside Heel Hook", "Submissions", "purple", 1),
  t("p1-08", "Outside Heel Hook", "Submissions", "purple", 1),
  t("p1-09", "Kneebar from Various Positions", "Submissions", "purple", 1),
  t("p1-10", "Toe Hold", "Submissions", "purple", 1),
  t("p1-11", "Calf Slicer", "Submissions", "purple", 1),
  t("p1-12", "Saddle/411 Position Control", "Positional Control", "purple", 1),
  t("p1-13", "Advanced Takedown Combinations", "Takedowns", "purple", 1),
  t("p1-14", "Judo Throws (Osoto Gari, Seoi Nage)", "Takedowns", "purple", 1),

  // Stripe 2 : Teaching & Advanced Concepts
  t("p2-01", "Chaining Leg Lock Entries", "Submissions", "purple", 2),
  t("p2-02", "Leg Lock Defense & Escapes", "Escapes & Defenses", "purple", 2),
  t("p2-03", "Advanced Back Attack System", "Submissions", "purple", 2),
  t("p2-04", "Truck Position & Calf Slicer", "Positional Control", "purple", 2),
  t("p2-05", "Lapel Guard Variations (Gi)", "Guard", "purple", 2),
  t("p2-06", "Worm Guard Basics", "Guard", "purple", 2),
  t("p2-07", "Advanced Half Guard : Coyote Guard", "Guard", "purple", 2),
  t("p2-08", "Teaching Methodology for White Belts", "Positional Control", "purple", 2),
  t("p2-09", "Analyzing Opponent Patterns", "Positional Control", "purple", 2),
  t("p2-10", "Footlock Defense : Boot", "Escapes & Defenses", "purple", 2),
  t("p2-11", "Toreando Counter Attacks", "Sweeps", "purple", 2),
  t("p2-12", "Maintaining Composure Under Submissions", "Escapes & Defenses", "purple", 2),

  // Stripe 3 : Mastery & Flow
  t("p3-01", "Transition Chains (5+ positions)", "Positional Control", "purple", 3),
  t("p3-02", "Advanced Sweeps from Open Guard", "Sweeps", "purple", 3),
  t("p3-03", "Inverting Safely", "Guard", "purple", 3),
  t("p3-04", "Leg Drag to Submission Chains", "Submissions", "purple", 3),
  t("p3-05", "Body Lock Takedown Series", "Takedowns", "purple", 3),
  t("p3-06", "Wrestling Scrambles", "Takedowns", "purple", 3),
  t("p3-07", "Advanced Turtle Attacks", "Submissions", "purple", 3),
  t("p3-08", "Float & React Passing", "Passes", "purple", 3),
  t("p3-09", "Stacking Pass Variations", "Passes", "purple", 3),
  t("p3-10", "Submission Defense from Anywhere", "Escapes & Defenses", "purple", 3),
  t("p3-11", "Creating Dilemmas (2-on-1 choices)", "Submissions", "purple", 3),
  t("p3-12", "Advanced Rolling Back Take", "Positional Control", "purple", 3),

  // Stripe 4 : Leadership & Competition Excellence
  t("p4-01", "Developing Training Plans for Students", "Positional Control", "purple", 4),
  t("p4-02", "Advanced Competition Strategy", "Positional Control", "purple", 4),
  t("p4-03", "Adapting Game to Opponent Style", "Positional Control", "purple", 4),
  t("p4-04", "No-Gi Wrestling Integration", "Takedowns", "purple", 4),
  t("p4-05", "Advanced Submission Escapes", "Escapes & Defenses", "purple", 4),
  t("p4-06", "Gi vs No-Gi Game Adaptation", "Positional Control", "purple", 4),
  t("p4-07", "Advanced Butterfly Hook Sweep Series", "Sweeps", "purple", 4),
  t("p4-08", "Submission Finishing Details", "Submissions", "purple", 4),
  t("p4-09", "Pace Control & Energy Management", "Positional Control", "purple", 4),
  t("p4-10", "Mentoring Lower Belts", "Positional Control", "purple", 4),
];

// ─── BROWN BELT ──────────────────────────────────────────
const brownBelt: Technique[] = [
  // Stripe 1
  t("br1-01", "Developing a Complete Personal System", "Positional Control", "brown", 1),
  t("br1-02", "Advanced Pressure Passing (HQ position)", "Passes", "brown", 1),
  t("br1-03", "Leg Entanglement Mastery", "Submissions", "brown", 1),
  t("br1-04", "Cross-Training Wrestling for BJJ", "Takedowns", "brown", 1),
  t("br1-05", "Judo Integration (advanced throws)", "Takedowns", "brown", 1),
  t("br1-06", "Guard System Refinement", "Guard", "brown", 1),
  t("br1-07", "Submission Setup Mastery", "Submissions", "brown", 1),
  t("br1-08", "Leading Warm-Ups & Drilling", "Positional Control", "brown", 1),
  t("br1-09", "Escape from Any Position Blindfolded", "Escapes & Defenses", "brown", 1),
  t("br1-10", "Controlling Distance (stand-up to ground)", "Positional Control", "brown", 1),

  // Stripe 2
  t("br2-01", "Full Class Instruction (fundamentals)", "Positional Control", "brown", 2),
  t("br2-02", "Advanced No-Gi Submission Chains", "Submissions", "brown", 2),
  t("br2-03", "Position-Specific Sparring Design", "Positional Control", "brown", 2),
  t("br2-04", "Counter-Wrestling for BJJ", "Takedowns", "brown", 2),
  t("br2-05", "Advanced Guard Passing Under Pressure", "Passes", "brown", 2),
  t("br2-06", "Invisible Jiu-Jitsu Concepts (grip breaks, framing)", "Escapes & Defenses", "brown", 2),
  t("br2-07", "Situational Training Design", "Positional Control", "brown", 2),
  t("br2-08", "Advanced Sweep Combinations", "Sweeps", "brown", 2),
  t("br2-09", "Tournament Corner Coaching", "Positional Control", "brown", 2),
  t("br2-10", "Self-Defense Application of BJJ", "Escapes & Defenses", "brown", 2),

  // Stripe 3
  t("br3-01", "Full Class Instruction (advanced)", "Positional Control", "brown", 3),
  t("br3-02", "Developing a School Curriculum", "Positional Control", "brown", 3),
  t("br3-03", "Advanced Body Mechanics & Leverage", "Positional Control", "brown", 3),
  t("br3-04", "Troubleshooting Student Techniques", "Positional Control", "brown", 3),
  t("br3-05", "Advanced Scramble Recovery", "Escapes & Defenses", "brown", 3),
  t("br3-06", "Linking Stand-Up to Ground Seamlessly", "Takedowns", "brown", 3),
  t("br3-07", "Chain Wrestling to Submission", "Submissions", "brown", 3),
  t("br3-08", "Fatigue-Proof Techniques", "Positional Control", "brown", 3),
  t("br3-09", "Reading & Reacting to Unknown Games", "Positional Control", "brown", 3),
  t("br3-10", "Refereeing Knowledge & Rules Mastery", "Positional Control", "brown", 3),

  // Stripe 4
  t("br4-01", "Personal Game Encyclopedic Knowledge", "Positional Control", "brown", 4),
  t("br4-02", "Preparing Students for Competition", "Positional Control", "brown", 4),
  t("br4-03", "Advanced Match Analysis", "Positional Control", "brown", 4),
  t("br4-04", "Building a Coaching Philosophy", "Positional Control", "brown", 4),
  t("br4-05", "Demonstrating Mastery Under All Conditions", "Positional Control", "brown", 4),
  t("br4-06", "Advanced Self-Defense Scenarios", "Escapes & Defenses", "brown", 4),
  t("br4-07", "Injury Prevention & Longevity Training", "Positional Control", "brown", 4),
  t("br4-08", "Mentorship Program Development", "Positional Control", "brown", 4),
];

// ─── BLACK BELT ──────────────────────────────────────────
const blackBelt: Technique[] = [
  t("bk0-01", "Complete Mastery of All Previous Techniques", "Positional Control", "black", 0),
  t("bk0-02", "Ability to Teach All Belt Levels Effectively", "Positional Control", "black", 0),
  t("bk0-03", "Developing Original Techniques & Variations", "Positional Control", "black", 0),
  t("bk0-04", "Community Leadership & Academy Growth", "Positional Control", "black", 0),
  t("bk0-05", "Contribution to the Art of Jiu-Jitsu", "Positional Control", "black", 0),
  t("bk0-06", "Competition Record & Achievement", "Positional Control", "black", 0),
  t("bk0-07", "Character, Respect & Sportsmanship", "Positional Control", "black", 0),
  t("bk0-08", "Years of Dedicated Training & Teaching", "Positional Control", "black", 0),
];

// ─── EXPORT ──────────────────────────────────────────────

export const CURRICULUM: BeltCurriculum[] = [
  { beltRank: "white", label: "White Belt", color: "#FFFFFF", techniques: whiteBelt },
  { beltRank: "blue", label: "Blue Belt", color: "#1E40AF", techniques: blueBelt },
  { beltRank: "purple", label: "Purple Belt", color: "#7C3AED", techniques: purpleBelt },
  { beltRank: "brown", label: "Brown Belt", color: "#92400E", techniques: brownBelt },
  { beltRank: "black", label: "Black Belt", color: "#1a1a1a", techniques: blackBelt },
];

/** Get all techniques for a specific belt and stripe */
export function getTechniquesForStripe(beltRank: string, stripe: number): Technique[] {
  const belt = CURRICULUM.find((c) => c.beltRank === beltRank);
  return belt?.techniques.filter((t) => t.stripe === stripe) || [];
}

/** Get all techniques required up to (and including) a belt rank and stripe */
export function getTechniquesUpTo(beltRank: string, stripe: number): Technique[] {
  const beltOrder = ["white", "blue", "purple", "brown", "black"];
  const beltIdx = beltOrder.indexOf(beltRank);
  const result: Technique[] = [];

  for (let i = 0; i <= beltIdx; i++) {
    const belt = CURRICULUM[i];
    for (const tech of belt.techniques) {
      if (i < beltIdx) {
        result.push(tech);
      } else if (tech.stripe <= stripe) {
        result.push(tech);
      }
    }
  }
  return result;
}

/** Get techniques needed for the NEXT milestone */
export function getNextMilestoneTechniques(
  currentBelt: string,
  currentStripes: number
): { beltRank: string; stripe: number; label: string; techniques: Technique[] } {
  const beltOrder = ["white", "blue", "purple", "brown", "black"];
  const beltIdx = beltOrder.indexOf(currentBelt);

  if (currentStripes < 4) {
    // Next stripe
    const nextStripe = currentStripes + 1;
    return {
      beltRank: currentBelt,
      stripe: nextStripe,
      label: `${currentBelt.charAt(0).toUpperCase() + currentBelt.slice(1)} Belt : Stripe ${nextStripe}`,
      techniques: getTechniquesForStripe(currentBelt, nextStripe),
    };
  } else if (beltIdx < beltOrder.length - 1) {
    // Next belt
    const nextBelt = beltOrder[beltIdx + 1];
    return {
      beltRank: nextBelt,
      stripe: 1,
      label: `${nextBelt.charAt(0).toUpperCase() + nextBelt.slice(1)} Belt : Stripe 1`,
      techniques: getTechniquesForStripe(nextBelt, 1),
    };
  }

  return { beltRank: "black", stripe: 0, label: "Black Belt", techniques: getTechniquesForStripe("black", 0) };
}

/** Total technique count across all belts */
export function getTotalTechniqueCount(): number {
  return CURRICULUM.reduce((sum, b) => sum + b.techniques.length, 0);
}
