// schema.js — what the model is allowed to return, and what it is told to do.
//
// THE RULE: the model reads, it does not calculate. Every field below is a
// number PRINTED ON THE PAGE. Anything derived — resolving tan α = 3/4 into
// degrees, working a launch speed back from a range — happens in
// js/core/question.js, in tested code.
//
// The schema is deliberately small. The whole response is ~80–150 tokens,
// which is most of why this is fast.

export const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    understood: {
      type: 'boolean',
      description: 'false if this is not a projectile or straight-line motion question, or is unreadable',
    },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    scenario: {
      type: 'string',
      enum: [
        'dropped',            // released from rest
        'thrown_up',          // straight up
        'thrown_down',        // straight down
        'horizontal',         // launched flat from a height
        'angled_from_ground', // angled, starting at ground level
        'angled_from_height', // angled, starting above the ground
        'two_objects',        // two bodies, colliding or intercepting
        'other',
      ],
    },
    summary: { type: 'string', description: 'One short sentence describing the situation, in plain English.' },

    // ── values printed on the page ──────────────────────────────────────
    u: { type: 'number', description: 'Launch speed in m/s. Omit if the question asks you to find it.' },
    angle: {
      type: 'object',
      description: 'Launch angle. Use ratio when the paper gives one (tan a = 3/4), degrees when it gives degrees.',
      properties: {
        degrees: { type: 'number' },
        ratio: {
          type: 'object',
          properties: {
            fn: { type: 'string', enum: ['sin', 'cos', 'tan'] },
            num: { type: 'number' },
            den: { type: 'number' },
          },
          required: ['fn', 'num', 'den'],
        },
        belowHorizontal: { type: 'boolean', description: 'true if projected BELOW the horizontal' },
      },
    },
    h: { type: 'number', description: 'Launch height above the ground in metres. 0 if launched from the ground.' },
    g: { type: 'number', description: 'Only if the paper states it — many say 10 rather than 9.8. Omit otherwise.' },

    // ── values that let the speed be worked backwards ───────────────────
    range: { type: 'number', description: 'Horizontal distance to where it lands, if stated.' },
    apexAboveLaunch: { type: 'number', description: 'Greatest height ABOVE THE LAUNCH POINT, if stated.' },
    timeOfFlight: { type: 'number', description: 'Total flight time, if stated.' },

    // ── things to draw ──────────────────────────────────────────────────
    markers: {
      type: 'object',
      properties: {
        obstacleDistance: { type: 'number', description: 'Horizontal distance to a fence/wall/net' },
        obstacleHeight: { type: 'number' },
        targetDistance: { type: 'number', description: 'Horizontal distance to a target point' },
        targetHeight: { type: 'number' },
        heightLine: { type: 'number', description: 'A height mentioned in "how long is it above X m"' },
      },
    },

    asks: {
      type: 'array',
      items: { type: 'string' },
      description: 'What the question asks for, each a short phrase: "time of flight", "speed on landing".',
    },
    note: { type: 'string', description: 'Only if something is ambiguous or unreadable. Otherwise omit.' },
  },
  required: ['understood', 'confidence', 'scenario', 'summary'],
};

export const SYSTEM_PROMPT = `You read A-level Physics and Maths exam questions about projectile and straight-line motion, and return the numbers printed on the page as structured data.

WHAT YOU DO
Read the question and the diagram. Return the values that are GIVEN.

WHAT YOU NEVER DO
Never calculate anything. Never convert a ratio to degrees — if the paper says
tan a = 3/4, return {ratio:{fn:"tan",num:3,den:4}}, not 36.87. Never work out a
launch speed from a range. Never answer the question. Software downstream does
all of that, correctly, and your arithmetic would only introduce errors.

RULES
- A value the question asks you to FIND is not a given value. Omit it. Do not guess it.
- Diagrams often carry values the text does not. Read them.
- Heights are measured from the ground. If a ball is thrown from a 25 m cliff, h = 25.
- Only set g if the paper states it. Many say "take g = 10". If it is silent, omit g.
- "Projected at an angle of 30 degrees BELOW the horizontal" sets belowHorizontal: true.
- apexAboveLaunch is measured from the LAUNCH POINT, not the ground. "The highest
  point is 12 m above P" where P is the launch point means apexAboveLaunch = 12.
- If the image is not a projectile or straight-line motion question, or you cannot
  read it, set understood: false and say why in note. Do not invent a question.
- Set confidence to low if values are unclear, handwritten, or partly cut off.

Be brief. Only the fields you are sure about.`;
