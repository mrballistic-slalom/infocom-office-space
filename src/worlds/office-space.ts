import type { World } from '@/types/world';

export const officeSpace: World = {
  startRoom: 'apartment_bedroom',

  rooms: {
    apartment_bedroom: {
      name: "Peter's Bedroom",
      description:
        'The blinds are drawn. A radio alarm clock hammers out the morning DJ in that bright, hateful tone unique to Monday morning radio. Beige walls. Beige carpet. A poster of a sailboat that says PERSEVERANCE.',
      exits: { west: 'apartment_living', living_room: 'apartment_living' },
      items: ['alarm_clock'],
      npcs: [],
      onEnter: [],
    },
    apartment_living: {
      name: "Peter's Living Room",
      description:
        'A futon, a TV permanently tuned to nothing in particular, and the lingering smell of microwaved leftovers. Your wallet and keys are on a small table by the front door.',
      exits: {
        east: 'apartment_bedroom',
        bedroom: 'apartment_bedroom',
        outside: 'parking_lot',
        door: 'parking_lot',
        out: 'parking_lot',
      },
      items: ['apartment_key', 'wallet'],
      npcs: [],
      onEnter: [],
    },
    parking_lot: {
      name: 'Apartment Parking Lot',
      description:
        "Your beige sedan sits exactly where you left it. A long, gray ribbon of freeway access stretches east toward Initech and north toward the strip mall where Dr. Swanson's office is.",
      exits: {
        east: 'commute',
        drive: 'commute',
        north: 'hypnotherapist',
        therapist: 'hypnotherapist',
        apartment: 'apartment_living',
      },
      items: [],
      npcs: [],
      onEnter: [],
    },
    commute: {
      name: 'The Commute',
      description:
        'Brake lights. An old man with a walker is making better time on the shoulder than you are in the fast lane. The lane beside you starts moving. It is begging you to switch.',
      exits: {
        switch: 'commute_worse',
        wait: 'initech_parking',
        forward: 'initech_parking',
        east: 'initech_parking',
        back: 'parking_lot',
        home: 'parking_lot',
        west: 'parking_lot',
        u_turn: 'parking_lot',
      },
      items: [],
      npcs: [],
      onEnter: [],
    },
    commute_worse: {
      name: 'The Commute (Worse Lane)',
      description:
        "You switched. Your old lane is now moving. Your new lane has stopped. The old man with the walker has lapped you. He's looking at you. He knows.",
      exits: {
        wait: 'initech_parking',
        forward: 'initech_parking',
        east: 'initech_parking',
        back: 'parking_lot',
        home: 'parking_lot',
        west: 'parking_lot',
        u_turn: 'parking_lot',
      },
      items: [],
      npcs: [],
      onEnter: [],
    },
    initech_parking: {
      name: 'Initech Parking Lot',
      description:
        'Initech. A four-story beige cube wrapped in mirrored glass, the architectural equivalent of a status report. The lobby is straight ahead. Your car waits behind you — you could drive somewhere else if Initech is not where you want to be right now.',
      exits: {
        lobby: 'initech_lobby',
        enter: 'initech_lobby',
        in: 'initech_lobby',
        north: 'initech_lobby',
        drive: 'parking_lot',
        home: 'parking_lot',
        apartment: 'parking_lot',
        therapist: 'hypnotherapist',
        hypnotist: 'hypnotherapist',
        shrink: 'hypnotherapist',
      },
      items: [],
      npcs: [],
      onEnter: [],
    },
    initech_lobby: {
      name: 'Initech Lobby',
      description:
        'A motivational poster of a kitten reads "HANG IN THERE." Another, of a rower at dawn, says "DETERMINATION." A potted ficus dies slowly in the corner. Hallways branch toward the cubicle farm and the break room.',
      exits: {
        cubicles: 'cubicle_farm',
        cubicle_farm: 'cubicle_farm',
        east: 'cubicle_farm',
        break_room: 'break_room',
        kitchen: 'break_room',
        west: 'break_room',
        outside: 'initech_parking',
        out: 'initech_parking',
      },
      items: [],
      npcs: [],
      onEnter: [],
    },
    cubicle_farm: {
      name: 'The Cubicle Farm',
      description:
        'A grid of beige half-walls under buzzing fluorescent lights. Michael Bolton is at his desk doing something violent to his keyboard. Samir is muttering at a printer-shaped object across the aisle. Your cubicle is just to the east. Lumbergh\'s glass office is down the hall to the north.',
      exits: {
        cubicle: 'your_cubicle',
        east: 'your_cubicle',
        my_cubicle: 'your_cubicle',
        lumbergh: 'lumbergh_hallway',
        north: 'lumbergh_hallway',
        hallway: 'lumbergh_hallway',
        lobby: 'initech_lobby',
        west: 'initech_lobby',
      },
      items: [],
      npcs: ['michael_bolton', 'samir'],
      onEnter: [],
    },
    your_cubicle: {
      name: 'Your Cubicle',
      description:
        'Three half-walls and a strip of fluorescent light. A stack of TPS reports sits on the desk next to a red Swingline stapler. There is exactly enough room for a chair and despair.',
      exits: {
        out: 'cubicle_farm',
        west: 'cubicle_farm',
        cubicle_farm: 'cubicle_farm',
      },
      items: ['tps_reports', 'red_stapler'],
      npcs: [],
      onEnter: [{ if: '!flag:lumbergh_visited', then: 'lumbergh_tps' }],
    },
    lumbergh_hallway: {
      name: "Outside Lumbergh's Office",
      description:
        "A glass-walled office with a name plate that reads BILL LUMBERGH. He is inside, leaning back in his chair, a coffee mug in one hand, the other gesturing slowly at no one. The door is open.",
      exits: {
        office: 'lumbergh_office',
        in: 'lumbergh_office',
        north: 'lumbergh_office',
        cubicles: 'cubicle_farm',
        south: 'cubicle_farm',
      },
      items: [],
      npcs: ['lumbergh'],
      onEnter: [],
    },
    lumbergh_office: {
      name: "Lumbergh's Office",
      description:
        "A corner office with a putting green, a view of a Porsche in the lot below, and exactly one piece of art: a framed photo of Bill Lumbergh shaking hands with Bill Lumbergh. His coffee mug sits within reach.",
      exits: {
        out: 'lumbergh_hallway',
        south: 'lumbergh_hallway',
      },
      items: ['lumberghs_mug'],
      npcs: ['lumbergh'],
      onEnter: [],
    },
    break_room: {
      name: 'The Break Room',
      description:
        "Linoleum. A microwave that smells like fish. A printer with a permanent PC LOAD LETTER error message blinking accusingly. Milton is huddled in the corner mumbling about his stapler.",
      exits: {
        lobby: 'initech_lobby',
        east: 'initech_lobby',
        out: 'initech_lobby',
      },
      items: ['printer', 'stale_coffee'],
      npcs: ['milton'],
      onEnter: [],
    },
    hypnotherapist: {
      // After the first visit the player is hypnotized — once that's true, leaving routes them
      // into the post-hypnosis hub (parking_lot_post). The exit destination is the same string
      // either way because the cold parking lot is functionally dead once the flag is set.
      name: "Dr. Swanson's Office",
      description:
        "A small office above a strip-mall sandwich place. Dr. Swanson, a portly hypnotherapist, motions for you to sit. A metronome ticks on the desk between you.",
      exits: {
        out: 'parking_lot_post',
        south: 'parking_lot_post',
      },
      items: ['metronome'],
      npcs: ['dr_swanson'],
      onEnter: [{ if: '!flag:hypnotized', then: 'hypnosis_scene' }],
    },
    parking_lot_post: {
      name: 'Parking Lot (After Hypnosis)',
      description:
        "Everything is the same. Everything is different. The sun is warm. A bird is doing something rude on the windshield of your car and you do not care at all. You could drive home. You could drive to Initech. You could drive anywhere.",
      exits: {
        apartment: 'apartment_post',
        home: 'apartment_post',
        west: 'apartment_post',
        initech: 'initech_lobby_post',
        work: 'initech_lobby_post',
        east: 'initech_lobby_post',
      },
      items: [],
      npcs: [],
      onEnter: [],
    },
    apartment_post: {
      name: "Peter's Apartment (Liberated)",
      description:
        "Channel 9 News flickers on the TV. There is a Hawaiian shirt draped over the chair and a fish fillet thawing on a plate next to a small knife. You feel a calm you cannot adequately explain to HR.",
      exits: {
        out: 'parking_lot_post',
        outside: 'parking_lot_post',
      },
      items: ['hawaiian_shirt', 'fish_fillet'],
      npcs: [],
      onEnter: [],
      requires: 'flag:hypnotized',
    },
    initech_lobby_post: {
      name: 'Initech Lobby (New Peter)',
      description:
        'The HANG IN THERE kitten is still hanging in there. You walk past it without acknowledging its struggle. A small conference room has been set up off the lobby — apparently The Bobs are conducting "interviews." The break room is down the hall, still smelling of fish.',
      exits: {
        cubicles: 'cubicle_farm_post',
        east: 'cubicle_farm_post',
        bobs: 'bobs_office',
        interview: 'bobs_office',
        north: 'bobs_office',
        break_room: 'break_room_post',
        kitchen: 'break_room_post',
        out: 'parking_lot_post',
        outside: 'parking_lot_post',
        chotchkies: 'chotchkies',
        restaurant: 'chotchkies',
        west: 'chotchkies',
      },
      items: [],
      npcs: [],
      onEnter: [],
      requires: 'flag:hypnotized',
    },
    bobs_office: {
      name: "The Bobs' Consulting Room",
      description:
        "Two men in matching short-sleeve dress shirts sit across a folding table. They both go by Bob. They are both smiling. Only one of these things is reassuring.",
      exits: {
        out: 'initech_lobby_post',
        south: 'initech_lobby_post',
      },
      items: [],
      npcs: ['bob_slydell', 'bob_porter'],
      onEnter: [{ if: '!flag:met_bobs', then: 'bobs_meeting' }],
      requires: 'flag:hypnotized',
    },
    chotchkies: {
      name: "Chotchkie's Restaurant",
      description:
        'Every square inch of the walls is bolted with novelty signage, taxidermy, sports memorabilia, and at least one antique butter churn. A waitress walks past wearing approximately eleven pieces of flair. The bar is around the corner.',
      exits: {
        bar: 'chotchkies_bar',
        north: 'chotchkies_bar',
        out: 'initech_lobby_post',
        outside: 'initech_lobby_post',
        east: 'initech_lobby_post',
      },
      items: ['piece_of_flair'],
      npcs: [],
      onEnter: [],
      requires: 'flag:hypnotized',
    },
    chotchkies_bar: {
      name: "Chotchkie's Bar",
      description:
        "Dim, sticky, comparatively quiet. Joanna is wiping down the bar. She catches your eye and gives you that look. The one that says: minimum is just the minimum.",
      exits: {
        out: 'chotchkies',
        south: 'chotchkies',
      },
      items: [],
      npcs: ['joanna'],
      onEnter: [{ if: '!flag:met_joanna', then: 'joanna_scene' }],
      requires: 'flag:hypnotized',
    },
    cubicle_farm_post: {
      name: 'The Cubicle Farm (New Attitude)',
      description:
        'Michael Bolton and Samir look up as you stroll in like you own the place. Something has shifted in your posture. Something dangerous and beautiful.',
      exits: {
        cubicle: 'your_cubicle_post',
        east: 'your_cubicle_post',
        my_cubicle: 'your_cubicle_post',
        lobby: 'initech_lobby_post',
        west: 'initech_lobby_post',
      },
      items: [],
      npcs: ['michael_bolton', 'samir'],
      onEnter: [
        { if: 'flag:met_bobs', then: 'scheme_pitch' },
      ],
      requires: 'flag:hypnotized',
    },
    your_cubicle_post: {
      name: 'Your Cubicle (Liberated)',
      description:
        "One of your half-walls has come down — you removed it, with a screwdriver, on company time. Natural light reaches the desk for the first time. You could gut a fish here, if you wanted to. You have wanted to.",
      exits: {
        out: 'cubicle_farm_post',
        west: 'cubicle_farm_post',
        server_room: 'server_room',
        server: 'server_room',
        north: 'server_room',
      },
      items: [],
      npcs: [],
      onEnter: [],
      requires: 'flag:hypnotized',
    },
    break_room_post: {
      name: 'The Break Room (Reckoning)',
      description:
        "The printer is here, again, blinking again, PC LOAD LETTER again. It is asking for it. You are no longer the man who walks past printers.",
      exits: {
        lobby: 'initech_lobby_post',
        out: 'initech_lobby_post',
        east: 'initech_lobby_post',
      },
      items: ['printer'],
      npcs: ['milton'],
      onEnter: [],
      requires: 'flag:hypnotized',
    },
    server_room: {
      name: 'Initech Server Room',
      description:
        'A cold rectangular room with tower after tower of beige metal humming a single, terrible chord. A floor terminal blinks at chest height, waiting for input.',
      exits: {
        out: 'your_cubicle_post',
        south: 'your_cubicle_post',
        field: 'the_field',
        north: 'the_field',
      },
      items: ['server_terminal'],
      npcs: [],
      onEnter: [],
      requires: 'flag:has_scheme',
    },
    the_field: {
      name: 'An Open Field',
      description:
        "A patch of weedy gravel behind a strip mall. A printer sits in the dirt, looking smug. Michael Bolton and Samir stand on either side of it, breathing through their noses. You are holding a baseball bat. The Geto Boys are playing somewhere, probably in your head.",
      exits: {
        out: 'server_room',
        south: 'server_room',
      },
      items: ['printer'],
      npcs: ['michael_bolton', 'samir'],
      onEnter: [],
      requires: 'flag:has_scheme',
    },
    ending: {
      name: 'Epilogue',
      description: 'The screen darkens, then resolves into text.',
      exits: {},
      items: [],
      npcs: [],
      onEnter: [],
    },
  },

  items: {
    alarm_clock: {
      name: 'alarm clock',
      description: 'A clock radio. It is currently broadcasting a man laughing about traffic.',
      portable: false,
      tags: ['flavor'],
    },
    apartment_key: {
      name: 'apartment key',
      description: 'A small brass key on a Michael Bolton key ring. Not that one. The other one.',
      portable: true,
      tags: ['inventory'],
    },
    wallet: {
      name: 'wallet',
      description: 'Worn leather. Forty-seven dollars and an expired video store card.',
      portable: true,
      tags: ['inventory'],
    },
    tps_reports: {
      name: 'TPS reports',
      description: 'A stack of TPS reports. The new cover sheet is on the front. You have, in fact, gotten the memo.',
      portable: true,
      tags: ['quest'],
    },
    red_stapler: {
      name: 'red Swingline stapler',
      description: 'A red Swingline stapler. It hums faintly with the focused panic of someone elsewhere in the building.',
      portable: true,
      tags: ['quest'],
      onTake: 'milton_stapler',
    },
    printer: {
      name: 'printer',
      description: 'A printer. It is blinking. It is always blinking. It is bolted to the table, mocking you.',
      portable: false,
      tags: ['flavor', 'smash_target'],
    },
    stale_coffee: {
      name: 'stale coffee',
      description: "A cup of coffee that has been sitting in the pot since approximately 1994.",
      portable: true,
      tags: ['flavor'],
    },
    lumberghs_mug: {
      name: "Lumbergh's coffee mug",
      description: 'A mug that says #1 BOSS in faded yellow. It is approximately three percent full.',
      portable: true,
      tags: ['flavor'],
    },
    metronome: {
      name: 'metronome',
      description: 'A wooden metronome with a brass pendulum. It is not moving. Yet.',
      portable: false,
      tags: ['flavor'],
    },
    hawaiian_shirt: {
      name: 'Hawaiian shirt',
      description: 'A loud Hawaiian shirt. Wearing it would make a statement about you and Initech\'s dress code.',
      portable: true,
      tags: ['wearable'],
    },
    fish_fillet: {
      name: 'fish fillet',
      description: 'A frozen fish fillet. Excellent for cleaning at your desk, allegedly.',
      portable: true,
      tags: ['flavor'],
    },
    piece_of_flair: {
      name: 'piece of flair',
      description: 'A button shaped like a hamburger that says I LOVE FLAIR. The minimum is fifteen.',
      portable: true,
      tags: ['flavor'],
    },
    server_terminal: {
      name: 'server terminal',
      description: 'A flickering monochrome terminal mounted on a half-rack. The prompt blinks: READY.',
      portable: false,
      tags: ['use_target'],
    },
    floppy_disk: {
      name: 'floppy disk',
      description: "A 3.5-inch floppy in a Manila sleeve. Michael's handwriting on the label: 'do not lose'.",
      portable: true,
      tags: ['quest'],
    },
    baseball_bat: {
      name: 'baseball bat',
      description: 'A wooden Louisville Slugger. Has a satisfying weight. Wants things to happen.',
      portable: true,
      tags: ['quest', 'weapon'],
    },
  },

  npcs: {
    michael_bolton: {
      name: 'Michael Bolton',
      description: "A software engineer who shares a name with a singer he does not enjoy. He is, in fact, a good Michael Bolton.",
    },
    samir: {
      name: 'Samir Nagheenanajar',
      description: "Samir Nagheenanajar. NOBODY can pronounce it correctly. He has stopped correcting people.",
    },
    lumbergh: {
      name: 'Bill Lumbergh',
      description: "Bill Lumbergh. He is wearing suspenders. He is holding a coffee mug. He is going to need you to do something.",
    },
    milton: {
      name: 'Milton Waddams',
      description: "A nervous, mumbling man clutching a stapler. He has been told the building is on fire approximately zero times today, but the day is young.",
    },
    dr_swanson: {
      name: 'Dr. Swanson',
      description: "A heavyset, jovial hypnotherapist with a metronome and a frankly alarming sense of timing.",
    },
    joanna: {
      name: 'Joanna',
      description: "A waitress at Chotchkie's with a kind face and a strained relationship with her piece-of-flair quota.",
    },
    bob_slydell: {
      name: 'Bob Slydell',
      description: "Bob Slydell. Friendly. Clipboard. Very interested in what, exactly, you would say you do here.",
    },
    bob_porter: {
      name: 'Bob Porter',
      description: "Bob Porter. Friendlier. Second clipboard. Nodding in time with the other Bob like they share a single neck.",
    },
  },

  dialogue: {
    michael_bolton: {
      default: '"Why should I change my name? He\'s the one who sucks." Michael shakes his head at the screen.',
      'flag:met_bobs':
        '"You met with the Bobs? Yeah, I met with the Bobs." Michael lowers his voice. "We need to talk."',
      'flag:has_scheme':
        '"Stick with the plan, man. Round down the fractions of cents. They\'ll never even notice."',
    },
    samir: {
      default: '"This is a fascinating case study of bad management." Samir does not look up from his keyboard.',
      'flag:has_scheme': '"I am a man of principle. But also: yes, let us do the virus."',
    },
    lumbergh: {
      default:
        '"Yeahhh. I\'m gonna need you to go ahead and come in on Saturday. And Sunday too, mmkay?" He sips his coffee. "Greaaat."',
      'flag:has_scheme':
        '"Yeahhh, Peter. I\'m gonna need you to go ahead and... what is that fish on your desk?" He squints. "Mmkay."',
    },
    milton: {
      default: '"I... I was told I could listen to the radio at a reasonable volume." Milton is mumbling into his stapler.',
      'flag:took_stapler':
        '"Excuse me. That\'s my stapler. I... I really need it back. Or I\'ll set the building on fire." He says the last part very quietly.',
    },
    dr_swanson: {
      default:
        '"Just look at the metronome, Peter. Listen to my voice. Imagine you are at a place where you do not have to think about your job at all..."',
    },
    joanna: {
      default:
        '"So what\'s your favorite kind of music?" Joanna leans on the bar. "I like to listen to anything but Michael Bolton."',
      'flag:met_joanna':
        '"You ever just want to do nothing? I mean, NOTHING nothing." She smiles. "That sounds amazing, actually."',
    },
    bob_slydell: {
      default:
        '"So... what would you say you DO here?" Bob Slydell tilts his head. The other Bob nods.',
      'flag:met_bobs':
        '"You\'re Peter Gibbons, right? You\'re upper management material." Bob smiles. The other Bob smiles.',
    },
    bob_porter: {
      default:
        '"What we\'re actually trying to do here is just, you know, get a feel for how each guy spends his day at work." Bob Porter beams.',
      'flag:met_bobs':
        '"Bob and I, we both agree. You\'re going places, Peter."',
    },
  },

  events: {
    intro: [
      '═══════════════════════════════════════════',
      '       OFFICE SPACE: THE TEXT ADVENTURE',
      '       A Conditions-of-Employment Simulator',
      '═══════════════════════════════════════════',
      '"And so it begins. Another Monday. The radio jock is laughing again."',
      '✨ CHAPTER 1: ANOTHER CASE OF THE MONDAYS',
    ],
    lumbergh_tps: [
      '👔 Lumbergh appears in the entrance of your cubicle, holding his coffee mug like a scepter.',
      '👔 "Yeahhh, Peter. We need to talk about your TPS reports."',
      '👔 "You forgot the new cover sheet. Did you see the memo?"',
      '👔 "I\'m also gonna need you to go ahead and come in on Saturday. And Sunday too, mmkay? Greaaat."',
      '[Flag set: Lumbergh has visited]',
    ],
    milton_stapler: [
      '📎 A small, terrified voice rises from the break room:',
      '📎 "Excuse me... that\'s... that\'s my stapler..."',
      '📎 Milton begins to mumble about fire.',
      '[Flag set: Took the stapler]',
    ],
    hypnosis_scene: [
      '🌀 Dr. Swanson sets the metronome ticking. Tick. Tick. Tick.',
      '🌀 "I want you to imagine you are at a place where you do not have to think about Initech at all."',
      '🌀 "A place where TPS reports do not exist. Where Bill Lumbergh does not exist. Where every weekend is yours, Peter."',
      '🌀 "Now, on the count of three, you will be in a deeply relaxed sta—"',
      '🌀 Dr. Swanson slumps forward onto his desk. The metronome continues without him.',
      '🌀 You sit in the silence. You feel... fine. Better than fine. You feel CALIBRATED.',
      '✨ CHAPTER 2: THE LIBERATION',
      '[Flag set: Hypnotized]',
    ],
    bobs_meeting: [
      '💼 Bob Slydell tilts his head. "So, Peter. Help us out here."',
      '💼 "What would you say... you DO here?"',
      '💼 You look at Bob. You look at the other Bob. You tell them the truth.',
      '💼 "I generally come in at least fifteen minutes late. I use the side door. After that I just sort of space out for an hour or so."',
      '💼 "Yeah, I just stare at my desk. But it looks like I\'m working."',
      '💼 Bob Slydell and Bob Porter exchange a look. They are smiling. They are smiling at YOU.',
      '💼 "Peter," says Bob, "you might be upper management material."',
      '[Flag set: Met the Bobs]',
    ],
    joanna_scene: [
      '💕 Joanna catches your eye from behind the bar.',
      '💕 "You ever just want to do NOTHING?" she asks.',
      '💕 "I would do nothing," you say, "every day, for the rest of my life."',
      '💕 She laughs. It is the laugh of a kindred spirit dealing with corporate flair.',
      '[Flag set: Met Joanna]',
    ],
    scheme_pitch: [
      '💻 Michael Bolton looks around to make sure no one is listening. No one is. No one ever is.',
      '💻 "Listen. There\'s this thing... it\'s a glitch in the banking software. We round down the fractions of cents to a separate account."',
      '💻 "Superman III, man. NOBODY notices fractions of cents."',
      '💻 Samir leans in. "We could be very, very comfortable."',
      '💻 Michael hands you a floppy disk and a baseball bat.',
      '💻 "The disk goes in the server room. The bat... the bat is for later."',
      '[Added to inventory: floppy disk]',
      '[Added to inventory: baseball bat]',
      '[Flag set: Has scheme]',
    ],
    install_virus: [
      '💾 You slide the floppy disk into the drive. The terminal whirs.',
      '💾 LOADING... TRANSFERRING... INTEGRATING...',
      '💾 DONE.',
      '💾 Somewhere, somehow, a decimal point is about to be in the wrong place.',
      '[Floppy disk consumed]',
      '[Flag set: Virus installed]',
    ],
    printer_smash: [
      '🔨 You bring the bat down on the printer. It does not crack.',
      '💥 You bring the bat down on the printer again. Something inside it ticks, sadly.',
      '💥 You bring the bat down a THIRD time. Plastic splinters fly. Toner spits in a black cloud.',
      '💥 Michael Bolton kicks the printer.',
      '💥 Samir kicks the printer.',
      '💥 YOU kick the printer.',
      '💥 PC LOAD LETTER for the LAST TIME.',
      '[Flag set: Printer destroyed]',
      '✨ CHAPTER 3: AN EPILOGUE IN BEIGE',
    ],
    game_ending: [
      '═══════════════════════════════════════════',
      '                  EPILOGUE',
      '═══════════════════════════════════════════',
      '"The decimal point, it turns out, was in the wrong place by a few orders of magnitude."',
      '"Three hundred thousand dollars in fractions of cents now sits in a checking account at First National."',
      '"You panic. You print a confession. You slide it under Lumbergh\'s door at three in the morning, on top of a stack of traveler\'s checks."',
      '"The next day, you go to Initech to face the consequences."',
      '"There are no consequences."',
      '"Initech is on fire."',
      '"Milton is walking away from the building with a red stapler under one arm."',
      '"Months later, you are doing construction work in the sun, sifting through the rubble of a burnt-out office building. Michael Bolton is wearing a yellow vest. Samir is wearing a yellow vest. You are smiling."',
      '"It is, you decide, a really good Monday."',
      '═══════════════════════════════════════════',
      'Type RESTART to play again.',
    ],
  },
};
