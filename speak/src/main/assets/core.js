/* Talk Time: content + forgiving answer checking. Pure logic, no DOM (unit-tested in Node). */
(function (root) {
  'use strict';

  /* ---------------- content ----------------
     w  = word to say, e = picture, a = other answers we accept,
     x  = an "expansion" sentence (speech therapists model one step longer) */
  const WORDS = [
    // animals
    { e: '🐕', w: 'dog', a: ['doggy', 'doggie', 'puppy', 'dogs'], x: 'A happy dog. Woof woof!' },
    { e: '🐈', w: 'cat', a: ['kitty', 'kitten', 'cats'], x: 'A soft cat. Meow!' },
    { e: '🐄', w: 'cow', a: ['cows'], x: 'A big cow. Moo!' },
    { e: '🦆', w: 'duck', a: ['ducky', 'duckie', 'ducks'], x: 'A little duck. Quack quack!' },
    { e: '🐟', w: 'fish', a: ['fishy', 'fishes'], x: 'A fish. It swims in water.' },
    { e: '🐦', w: 'bird', a: ['birdie', 'birdy', 'birds'], x: 'A bird. It can fly.' },
    { e: '🐔', w: 'hen', a: ['chicken', 'chick'], x: 'A hen. Cluck cluck!' },
    { e: '🐎', w: 'horse', a: ['horsey', 'horsie', 'pony'], x: 'A horse. Clip clop!' },
    { e: '🐑', w: 'sheep', a: ['lamb'], x: 'A fluffy sheep. Baa!' },
    { e: '🦁', w: 'lion', a: ['lions'], x: 'A big lion. Roar!' },
    { e: '🐘', w: 'elephant', a: ['ellie', 'elefant'], x: 'A big elephant.' },
    { e: '🐒', w: 'monkey', a: ['monkeys'], x: 'A funny monkey.' },
    { e: '🐇', w: 'rabbit', a: ['bunny', 'bunnie'], x: 'A rabbit. Hop hop!' },
    { e: '🐸', w: 'frog', a: ['froggy', 'froggie'], x: 'A green frog. Ribbit!' },
    { e: '🐝', w: 'bee', a: ['bees'], x: 'A busy bee. Buzz!' },
    { e: '🐖', w: 'pig', a: ['piggy', 'pigs', 'piggie'], x: 'A pink pig. Oink oink!' },
    { e: '🐢', w: 'turtle', a: ['tortoise'], x: 'A slow turtle.' },
    // food and drink
    { e: '🍎', w: 'apple', a: ['apples'], x: 'A red apple. Yummy!' },
    { e: '🍌', w: 'banana', a: ['nana', 'bananas'], x: 'A yellow banana.' },
    { e: '🥭', w: 'mango', a: ['mangoes', 'mangos'], x: 'A sweet mango.' },
    { e: '🍇', w: 'grapes', a: ['grape'], x: 'Little grapes.' },
    { e: '🍊', w: 'orange', a: ['oranges'], x: 'A round orange.' },
    { e: '🥛', w: 'milk', a: ['milky'], x: 'A cup of milk.' },
    { e: '💧', w: 'water', a: ['wawa', 'waters'], x: 'Cool water.' },
    { e: '🥚', w: 'egg', a: ['eggs'], x: 'An egg.' },
    { e: '🎂', w: 'cake', a: ['cakes'], x: 'A birthday cake!' },
    { e: '🍚', w: 'rice', a: [], x: 'A bowl of rice.' },
    { e: '🍞', w: 'bread', a: [], x: 'Some bread.' },
    { e: '🍪', w: 'biscuit', a: ['cookie', 'biscuits', 'cookies'], x: 'A crunchy biscuit.' },
    // things
    { e: '⚽', w: 'ball', a: ['balls', 'football'], x: 'A round ball. Kick!' },
    { e: '🚗', w: 'car', a: ['cars'], x: 'A car. Beep beep!' },
    { e: '🚌', w: 'bus', a: ['buses'], x: 'A big bus.' },
    { e: '🚂', w: 'train', a: ['trains', 'choo choo'], x: 'A train. Choo choo!' },
    { e: '✈️', w: 'plane', a: ['aeroplane', 'airplane', 'planes'], x: 'A plane in the sky.' },
    { e: '⛵', w: 'boat', a: ['boats', 'ship'], x: 'A boat on the water.' },
    { e: '🚲', w: 'cycle', a: ['bicycle', 'bike'], x: 'A cycle. Ring ring!' },
    { e: '🥤', w: 'cup', a: ['cups', 'glass'], x: 'A cup.' },
    { e: '🥄', w: 'spoon', a: ['spoons'], x: 'A spoon for eating.' },
    { e: '🪑', w: 'chair', a: ['chairs'], x: 'A chair to sit on.' },
    { e: '🛏️', w: 'bed', a: ['beds'], x: 'A cosy bed.' },
    { e: '📕', w: 'book', a: ['books'], x: 'A book to read.' },
    { e: '👟', w: 'shoe', a: ['shoes'], x: 'A shoe for your foot.' },
    { e: '🧢', w: 'cap', a: ['hat', 'caps'], x: 'A cap for your head.' },
    { e: '🧸', w: 'teddy', a: ['teddy bear', 'bear', 'teddies'], x: 'A soft teddy.' },
    { e: '🎈', w: 'balloon', a: ['balloons'], x: 'A balloon. Pop!' },
    { e: '🔑', w: 'key', a: ['keys'], x: 'A key for the door.' },
    { e: '🕰️', w: 'clock', a: ['clocks'], x: 'A clock. Tick tock!' },
    { e: '🚪', w: 'door', a: ['doors'], x: 'Open the door.' },
    { e: '📱', w: 'phone', a: ['phones', 'mobile'], x: 'A phone. Hello!' },
    { e: '☂️', w: 'umbrella', a: ['brella'], x: 'An umbrella for the rain.' },
    // body
    { e: '👃', w: 'nose', a: ['noses'], x: 'Your nose. Sniff sniff!' },
    { e: '👂', w: 'ear', a: ['ears'], x: 'An ear for listening.' },
    { e: '👁️', w: 'eye', a: ['eyes', 'i'], x: 'An eye for seeing.' },
    { e: '✋', w: 'hand', a: ['hands'], x: 'A hand. Wave hello!' },
    { e: '🦶', w: 'foot', a: ['feet'], x: 'A foot for walking.' },
    { e: '👄', w: 'mouth', a: ['lips'], x: 'Your mouth for talking.' },
    // nature and people
    { e: '☀️', w: 'sun', a: ['sunny', 'son'], x: 'The hot sun.' },
    { e: '🌙', w: 'moon', a: ['moons'], x: 'The moon at night.' },
    { e: '⭐', w: 'star', a: ['stars'], x: 'A shiny star.' },
    { e: '🌳', w: 'tree', a: ['trees'], x: 'A tall tree.' },
    { e: '🌸', w: 'flower', a: ['flowers'], x: 'A pretty flower.' },
    { e: '🌧️', w: 'rain', a: ['raining'], x: 'Rain. Pitter patter!' },
    { e: '👶', w: 'baby', a: ['babies'], x: 'A little baby.' },
    // everyday words at home in India
    { e: '🫓', w: 'roti', a: ['chapati', 'rotis', 'chapatti'], x: 'A hot roti. Yummy!' },
    { e: '🛺', w: 'auto', a: ['autos', 'rickshaw', 'auto rickshaw'], x: 'An auto. Beep beep!' },
    { e: '🩴', w: 'chappal', a: ['chappals', 'slipper', 'slippers'], x: 'Chappal for your feet.' },
    { e: '🧃', w: 'juice', a: ['juices', 'joos'], x: 'Yummy juice.' }
  ];

  /* How each picture comes alive when tapped or said: mv = movement, s = its sound. */
  const MOVES = {
    dog: ['run', 'Woof woof!'], cat: ['run', 'Meow!'], cow: ['walk', 'Moo!'], duck: ['waddle', 'Quack quack!'], fish: ['swim', 'Blub blub!'],
    bird: ['fly', 'Tweet tweet!'], hen: ['peck', 'Cluck cluck!'], horse: ['run', 'Neigh!'], sheep: ['hop', 'Baa!'], lion: ['roar', 'Roar!'],
    elephant: ['stomp', 'Pawoo!'], monkey: ['jump', 'Ooh ooh, aah aah!'], rabbit: ['hop', 'Hop hop!'], frog: ['jump', 'Ribbit!'],
    bee: ['fly', 'Buzz buzz!'], turtle: ['crawl', 'Slow and steady.'], pig: ['walk', 'Oink oink!'],
    car: ['drive', 'Vroom vroom!'], bus: ['drive', 'Beep beep!'], train: ['drive', 'Choo choo!'], plane: ['fly', 'Zoom!'],
    boat: ['swim', 'Splash!'], cycle: ['drive', 'Ring ring!'], auto: ['drive', 'Beep beep!'],
    ball: ['bounce', 'Bounce bounce!'], balloon: ['float', 'Up, up!'], clock: ['shake', 'Tick tock!'], phone: ['shake', 'Ring ring!'],
    baby: ['wiggle', 'Goo goo!'], star: ['spin', 'Twinkle twinkle!'], sun: ['spin', ''], moon: ['float', ''], rain: ['shake', 'Pitter patter!'],
    teddy: ['dance', ''], cake: ['bounce', 'Yummy!'], apple: ['bounce', 'Crunch!'], banana: ['wiggle', 'Yummy!'], umbrella: ['spin', ''],
    door: ['shake', 'Knock knock!'], key: ['shake', 'Jingle jingle!']
  };
  const moveOf = w => MOVES[w] || ['bounce', ''];

  /* "What does the ___ say?" */
  const SOUNDS = [
    { e: '🐄', n: 'cow', s: 'moo', a: ['mu', 'move', 'mooo', 'boo', 'moon'] },
    { e: '🐶', n: 'dog', s: 'woof woof', a: ['woof', 'wolf', 'bow wow', 'bow', 'wow', 'roof', 'boo'] },
    { e: '🐱', n: 'cat', s: 'meow', a: ['miaow', 'mew', 'me', 'now', 'mao', 'mia'] },
    { e: '🦆', n: 'duck', s: 'quack quack', a: ['quack', 'quake', 'crack', 'back', 'track'] },
    { e: '🐑', n: 'sheep', s: 'baa', a: ['ba', 'bah', 'bar', 'baaa', 'ma'] },
    { e: '🦁', n: 'lion', s: 'roar', a: ['raw', 'roll', 'row', 'ra', 'raa', 'war', 'rawr'] },
    { e: '🐓', n: 'hen', s: 'cluck cluck', a: ['cluck', 'bok', 'buck', 'click', 'luck'] },
    { e: '🐍', n: 'snake', s: 'hiss', a: ['his', 'sss', 'is', 'this', 'shh'] },
    { e: '🐝', n: 'bee', s: 'buzz', a: ['bus', 'buzzz', 'was', 'does', 'bzz'] },
    { e: '🐸', n: 'frog', s: 'ribbit', a: ['rabbit', 'ribit', 'rebbit', 'robert'] },
    { e: '🦉', n: 'owl', s: 'hoo hoo', a: ['hoo', 'who', 'hu', 'whoo', 'who who'] },
    { e: '🚂', n: 'train', s: 'choo choo', a: ['choo', 'chu', 'shoe', 'chew', 'two'] }
  ];

  /* "Tell Zippy": action words the child says to make the hero move (choice of two). */
  const ACTIONS = [
    { w: 'jump',  e: '🦘', a: ['jumping', 'jumps', 'jum', 'dump'], v: 'Zippy jumps!' },
    { w: 'spin',  e: '🌀', a: ['spinning', 'spins', 'pin', 'spin around', 'turn'], v: 'Zippy spins!' },
    { w: 'dance', e: '💃', a: ['dancing', 'dances', 'dan', 'dans'], v: 'Zippy dances!' },
    { w: 'fly',   e: '🚀', a: ['flying', 'flies', 'fy'], v: 'Zippy flies!' },
    { w: 'sleep', e: '😴', a: ['sleeping', 'seep', 'night night', 'nap'], v: 'Zippy sleeps. Shh!' },
    { w: 'wave',  e: '👋', a: ['waving', 'wave hi', 'hi', 'hello', 'bye bye', 'bye'], v: 'Zippy waves. Hi!' },
    { w: 'run',   e: '🏃', a: ['running', 'runs', 'wun', 'go fast'], v: 'Zippy runs!' },
    { w: 'big',   e: '🐘', a: ['bigger', 'biggie', 'very big', 'giant'], v: 'Zippy is big!' },
    { w: 'small', e: '🐭', a: ['little', 'tiny', 'smaller', 'mall'], v: 'Zippy is small!' },
    { w: 'up',    e: '⬆️', a: ['go up', 'up up', 'top'], v: 'Zippy goes up!' },
    { w: 'down',  e: '⬇️', a: ['go down', 'dow', 'sit down'], v: 'Zippy goes down!' },
    { w: 'clap',  e: '👏', a: ['clapping', 'claps', 'cap', 'tap'], v: 'Zippy claps!' },
    { w: 'kick',  e: '⚽', a: ['kicking', 'kick ball', 'tick'], v: 'Zippy kicks!' },
    { w: 'hide',  e: '🙈', a: ['hiding', 'peekaboo', 'peek a boo'], v: 'Where is Zippy? Peekaboo!' }
  ];

  /* Finish the line: we stop before the last word and let the child say it. */
  const RHYMES = [
    { e: '⭐', start: 'Twinkle, twinkle, little', w: 'star', a: ['stars', 'start'] },
    { e: '🐑', start: 'Baa, baa, black', w: 'sheep', a: ['ship', 'cheap'] },
    { e: '🥚', start: 'Humpty Dumpty sat on a', w: 'wall', a: ['ball', 'war', 'all', 'walls'] },
    { e: '🌧️', start: 'Rain, rain, go', w: 'away', a: ['way', 'a way'] },
    { e: '🚣', start: 'Row, row, row your', w: 'boat', a: ['boats', 'both', 'bought'] },
    { e: '⛰️', start: 'Jack and Jill went up the', w: 'hill', a: ['hills', 'heel', 'he'] },
    { e: '🚌', start: 'The wheels on the bus go round and', w: 'round', a: ['around', 'rounds'] },
    { e: '🚜', start: 'Old MacDonald had a', w: 'farm', a: ['firm', 'from', 'fun', 'far'] },
    { e: '🐑', start: 'Mary had a little', w: 'lamb', a: ['lam', 'lamp', 'land'] },
    { e: '🐒', start: 'Five little monkeys jumping on the', w: 'bed', a: ['bad', 'bread', 'bet'] },
    { e: '🦶', start: 'Head, shoulders, knees and', w: 'toes', a: ['toe', 'those', 'toys'] },
    { e: '🐭', start: 'Hickory, dickory,', w: 'dock', a: ['doc', 'duck', 'dog', 'dark'] }
  ];

  /* Two-word phrases: the next step after single words at 2-3 years. */
  const PHRASES = [
    { e: '⚽', big: true, p: 'big ball', m: 'A big ball!' },
    { e: '🍎', p: 'red apple', m: 'A red apple!' },
    { e: '🥛', p: 'more milk', m: 'More milk, please!' },
    { e: '👶💤', p: 'baby sleep', m: 'The baby is sleeping.' },
    { e: '👋', p: 'bye bye', m: 'Bye bye!' },
    { e: '🚗💨', p: 'car go', m: 'The car goes!' },
    { e: '🥛', p: 'hot milk', m: 'Hot milk!' },
    { e: '👟👟', p: 'my shoes', m: 'My shoes!' },
    { e: '🎂', p: 'yummy cake', m: 'Yummy cake!' },
    { e: '🐟💧', p: 'fish swim', m: 'The fish swims.' },
    { e: '🐦', p: 'bird fly', m: 'The bird flies.' },
    { e: '🧼✋', p: 'wash hands', m: 'Wash your hands!' },
    { e: '🐶', p: 'hello doggy', m: 'Hello, doggy!' },
    { e: '🌙', p: 'good night', m: 'Good night!' },
    { e: '🍌', p: 'eat banana', m: 'Eat a banana!' }
  ];


  /* Gifts Zippy gives. e = picture, n = name, s = what it says when tapped, a = how it moves. */
  const GIFTS = [
    // animal friends
    { e: '🐶', n: 'puppy', s: 'Woof woof! Hi friend!', a: 'bounce' },
    { e: '🐱', n: 'kitty', s: 'Meow! Hello!', a: 'wiggle' },
    { e: '🦆', n: 'duck', s: 'Quack quack!', a: 'swim' },
    { e: '🐸', n: 'frog', s: 'Ribbit! Jump!', a: 'jump' },
    { e: '🐘', n: 'elephant', s: 'Pawoo! Hello!', a: 'stomp' },
    { e: '🦁', n: 'lion', s: 'Roar!', a: 'shake' },
    { e: '🐒', n: 'monkey', s: 'Ooh ooh, aah aah!', a: 'dance' },
    { e: '🐰', n: 'bunny', s: 'Hop hop hop!', a: 'jump' },
    { e: '🐢', n: 'turtle', s: 'Hi! I am slow and steady.', a: 'crawl' },
    { e: '🐟', n: 'fish', s: 'Blub blub!', a: 'swim' },
    { e: '🐬', n: 'dolphin', s: 'Splash!', a: 'swim' },
    { e: '🦋', n: 'butterfly', s: 'Flutter flutter!', a: 'fly' },
    { e: '🐝', n: 'bee', s: 'Buzz buzz!', a: 'fly' },
    { e: '🐞', n: 'ladybug', s: 'Hello! I am a ladybug!', a: 'wiggle' },
    { e: '🐌', n: 'snail', s: 'Hi! I am a slow snail.', a: 'crawl' },
    { e: '🦒', n: 'giraffe', s: 'Hello from up high!', a: 'zoom' },
    { e: '🐧', n: 'penguin', s: 'Waddle waddle!', a: 'waddle' },
    { e: '🦉', n: 'owl', s: 'Hoo hoo!', a: 'spin' },
    { e: '🐄', n: 'cow', s: 'Moo!', a: 'bounce' },
    { e: '🐑', n: 'sheep', s: 'Baa baa!', a: 'bounce' },
    { e: '🐴', n: 'horse', s: 'Neigh! Clip clop!', a: 'slide' },
    { e: '🐷', n: 'piggy', s: 'Oink oink!', a: 'dance' },
    { e: '🐻', n: 'bear', s: 'Big bear hug!', a: 'dance' },
    { e: '🦄', n: 'unicorn', s: 'Magic!', a: 'spin' },
    { e: '🦖', n: 'dinosaur', s: 'Rawr! Stomp stomp!', a: 'stomp' },
    { e: '🐓', n: 'rooster', s: 'Cock a doodle doo!', a: 'jump' },
    { e: '🐳', n: 'whale', s: 'Splash! Hello!', a: 'swim' },
    { e: '🦀', n: 'crab', s: 'Snip snip!', a: 'sidestep' },
    // things that go
    { e: '🚗', n: 'car', s: 'Vroom vroom!', a: 'drive' },
    { e: '🚌', n: 'bus', s: 'Beep beep!', a: 'drive' },
    { e: '🚂', n: 'train', s: 'Choo choo!', a: 'drive' },
    { e: '✈️', n: 'aeroplane', s: 'Zoom! Up in the sky!', a: 'fly' },
    { e: '🚀', n: 'rocket', s: 'Three, two, one, blast off!', a: 'fly' },
    { e: '🚁', n: 'helicopter', s: 'Chop chop chop!', a: 'spin' },
    { e: '🚒', n: 'fire engine', s: 'Nee naw, nee naw!', a: 'drive' },
    { e: '🚜', n: 'tractor', s: 'Brrm brrm!', a: 'drive' },
    { e: '⛵', n: 'boat', s: 'Splish splash!', a: 'swim' },
    { e: '🚲', n: 'cycle', s: 'Ring ring!', a: 'drive' },
    { e: '🛵', n: 'scooter', s: 'Vroom!', a: 'drive' },
    { e: '🚑', n: 'ambulance', s: 'Nee naw! Here to help!', a: 'drive' },
    // toys and music
    { e: '🧸', n: 'teddy', s: 'Big hug!', a: 'dance' },
    { e: '⚽', n: 'ball', s: 'Bounce bounce!', a: 'bounce' },
    { e: '🎈', n: 'balloon', s: 'Up, up and away!', a: 'float' },
    { e: '🪁', n: 'kite', s: 'Whoosh! Flying high!', a: 'fly' },
    { e: '🥁', n: 'drum', s: 'Boom boom boom!', a: 'shake' },
    { e: '🎺', n: 'trumpet', s: 'Toot toot!', a: 'zoom' },
    { e: '🎸', n: 'guitar', s: 'Strum strum!', a: 'dance' },
    { e: '🎹', n: 'piano', s: 'Plink plonk!', a: 'wiggle' },
    { e: '🔔', n: 'bell', s: 'Ding dong!', a: 'shake' },
    { e: '🧩', n: 'puzzle', s: 'Click! It fits!', a: 'spin' },
    { e: '🎨', n: 'paints', s: 'Swish swish! So many colours!', a: 'spin' },
    { e: '🖍️', n: 'crayon', s: 'Draw draw draw!', a: 'wiggle' },
    { e: '📚', n: 'books', s: 'Story time!', a: 'zoom' },
    { e: '🤖', n: 'robot', s: 'Beep boop! Hello!', a: 'dance' },
    { e: '🪀', n: 'yo-yo', s: 'Up and down!', a: 'bounce' },
    // yummy things
    { e: '🍎', n: 'apple', s: 'Crunch crunch!', a: 'bounce' },
    { e: '🍌', n: 'banana', s: 'Yummy!', a: 'wiggle' },
    { e: '🍉', n: 'watermelon', s: 'Juicy!', a: 'bounce' },
    { e: '🍓', n: 'strawberry', s: 'Sweet!', a: 'bounce' },
    { e: '🍦', n: 'ice cream', s: 'Brr, cold! Yum!', a: 'shake' },
    { e: '🍪', n: 'biscuit', s: 'Crunch!', a: 'spin' },
    { e: '🎂', n: 'cake', s: 'Happy birthday!', a: 'zoom' },
    { e: '🥭', n: 'mango', s: 'Mango! Yummy!', a: 'bounce' },
    { e: '🍇', n: 'grapes', s: 'Pop pop pop!', a: 'bounce' },
    // sky and treasures
    { e: '🌟', n: 'star', s: 'Twinkle twinkle!', a: 'spin' },
    { e: '🌈', n: 'rainbow', s: 'So many colours!', a: 'zoom' },
    { e: '🌙', n: 'moon', s: 'Good night!', a: 'float' },
    { e: '☀️', n: 'sun', s: 'Good morning!', a: 'spin' },
    { e: '🌸', n: 'flower', s: 'Smells so nice!', a: 'wiggle' },
    { e: '🌻', n: 'sunflower', s: 'Hello, sunshine!', a: 'wiggle' },
    { e: '⛄', n: 'snowman', s: 'Brr! Hello!', a: 'wiggle' },
    { e: '🪐', n: 'planet', s: 'Hello from space!', a: 'spin' },
    { e: '👑', n: 'crown', s: 'You are a superstar!', a: 'zoom' },
    { e: '💎', n: 'jewel', s: 'Sparkle sparkle!', a: 'spin' },
    { e: '🏆', n: 'cup', s: 'Champion!', a: 'zoom' },
    { e: '🎉', n: 'party', s: 'Hooray!', a: 'dance' }
  ];

  /* Prompts the parrot uses to suggest something to say. */
  const PARROT_PROMPTS = [
    'Say hello!', 'Say ball!', 'Say banana!', 'Say bye bye!', 'Say your name!',
    'Make a funny sound!', 'Say I love you!', 'Say mama!', 'Say papa!', 'Sing a song!',
    'Say yummy!', 'Say thank you!', 'Say good morning!', 'Say moo!', 'Laugh! Ha ha ha!'
  ];

  const PRAISE = ['Yes!', 'Well done!', 'Great talking!', 'Super!', 'You said it!', 'Lovely!', 'Good job!'];
  const TRY_PRAISE = ['Good try!', 'Nice try!', 'Lovely trying!', 'Almost!', 'Good talking!'];

  /* ---------------- matching ---------------- */
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();

  function lev(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[b.length];
  }

  /**
   * Toddler sound key: groups sounds that 2-3 year olds swap.
   *  k/g/c/q -> t/d (fronting: "tat" for cat), r/l/y -> w ("wabbit"), th -> d/f,
   *  s-clusters lose the s ("poon", "tar"), vowels merge, h is dropped.
   */
  function sk(w) {
    let x = norm(w).replace(/\s+/g, '');
    if (!x) return '';
    x = x.replace(/^s(?=[ptkmnlw])/, '')          // spoon -> poon, star -> tar
         .replace(/ph/g, 'f').replace(/th/g, 'd').replace(/sh|ch|tch|j|z|x/g, 's')
         .replace(/ck|qu|q|c(?=[aou]|$)|k|g/g, 't').replace(/c/g, 's')
         .replace(/[dt]/g, 't').replace(/[bp]/g, 'p').replace(/[fv]/g, 'f')
         .replace(/[rlwy]/g, 'w').replace(/[mn]/g, 'm').replace(/h/g, '')
         .replace(/[aeiou]+/g, 'a').replace(/(.)\1+/g, '$1');
    return x;
  }
  /** Sounds like the target, the way a toddler would say it. */
  function soundsLike(tok, target) {
    const a = sk(tok), b = sk(target);
    if (!a || !b || a.length < 2) return false;
    if (a === b) return true;
    if (b.length >= 4 && a[0] === b[0] && lev(a, b) <= 1) return true;
    if (a.length >= 2 && b.startsWith(a) && a.length >= b.length - 1) return true;   // dropped ending: "ba" ~ ball
    if (a.length >= 3 && b.endsWith(a)) return true;                                   // dropped start: "nana"
    return false;
  }

  /* Common words a child (or the room) says that must never count as an attempt at another word. */
  const FILLER = new Set(['the','a','an','this','that','it','is','its','yes','no','not','ok','okay','hello','hi','hey','bye','mama','mummy','mom',
    'papa','daddy','dad','what','and','to','me','my','i','you','oh','uh','um','hmm','ah','see','look','there','here','want','go','do']);

  /** Every phrase/word the recogniser offered, as normalised strings and single tokens. */
  function candidates(heard) {
    const list = (Array.isArray(heard) ? heard : [heard]).map(norm).filter(Boolean);
    const tokens = new Set();
    list.forEach(p => { tokens.add(p); p.split(' ').forEach(t => t && tokens.add(t)); });
    return { phrases: list, tokens: [...tokens] };
  }

  function strictHit(tok, target) {
    if (tok === target) return true;
    const L = target.length;
    if (L >= 5 && lev(tok, target) <= 1) return true;      // "elefant", "bananna"
    if (L >= 4 && Math.abs(tok.length - L) <= 1 && tok.length >= 3 && lev(tok, target) <= 1 && tok[0] === target[0]) return true; // toddler sound swaps / dropped endings: "bawl", "fis", "duk"
    return false;
  }

  function looseHit(tok, target) {
    if (!tok || !target) return false;
    const L = target.length;
    if (lev(tok, target) <= (L <= 3 ? 1 : 2)) return true;          // ball~bowl, dog~dug
    if (tok.length >= 3 && target.endsWith(tok)) return true;        // nana -> banana
    if (tok.length >= 2 && target.startsWith(tok) && L >= 3) return true; // "bana", "ele", "ca"
    if (tok.length === 2 && tok[0] === target[0] && /[aeiou]/.test(tok[1]) && /[aeiou]/.test(target[1] || '') && target.length <= 5) return true; // first syllable: "ba" ball, "ka" cat
    if (tok[0] === target[0] && Math.abs(tok.length - L) <= 1 && L >= 3 && lev(tok, target) <= Math.ceil(L / 2)) return true;
    return false;
  }

  /**
   * Judge one turn.
   *  heard  = array of recogniser alternatives (may be empty)
   *  target = main word or phrase, accept = other accepted answers
   * returns 'yes' | 'close' | 'no'
   */
  function judge(heard, target, accept) {
    const t = norm(target);
    const ok = [t].concat((accept || []).map(norm)).filter(Boolean);
    const { phrases, tokens } = candidates(heard);
    if (!phrases.length) return 'no';

    // exact word or accepted variant anywhere in what was heard ("choochoo" counts as "choo choo")
    for (const o of ok) {
      if (o.includes(' ') && tokens.includes(o.replace(/ /g, ''))) return 'yes';
      if (o.includes(' ')) {
        if (phrases.some(p => (' ' + p + ' ').includes(' ' + o + ' '))) return 'yes';
      } else if (tokens.some(tok => strictHit(tok, o))) return 'yes';
    }
    // close enough to count as a real attempt at the word (fillers like "the", "yes", "papa" never count)
    const real = tokens.filter(tok => !FILLER.has(tok) || ok.includes(tok));
    for (const o of ok) {
      const parts = o.split(' ');
      if (parts.some(part => part.length >= 2 && real.some(tok => looseHit(tok, part) || soundsLike(tok, part)))) return 'close';
      if (real.some(tok => soundsLike(tok, o))) return 'close';
    }
    return 'no';
  }

  /** Two-word phrase: 'yes' if both words, 'half' if one, else 'no'. */
  function judgePhrase(heard, phrase) {
    const words = norm(phrase).split(' ');
    const { phrases, tokens } = candidates(heard);
    if (!phrases.length) return 'no';
    const joined = words.join('');
    if (tokens.some(tok => tok === joined || (joined.length >= 6 && lev(tok, joined) <= 1))) return 'yes';
    let hits = 0, near = 0;
    for (const w of words) {
      if (tokens.some(tok => strictHit(tok, w))) hits++;
      else if (tokens.some(tok => !FILLER.has(tok) && (looseHit(tok, w) || soundsLike(tok, w)))) near++;
    }
    if (hits === words.length) return 'yes';
    if (hits + near >= words.length && hits >= 1) return 'yes';
    if (hits + near >= 1) return 'half';
    return 'no';
  }

  /** Two actions that don't sound alike, so the child's choice is always clear. */
  function actionPair(rand) {
    const r = rand || Math.random;
    for (let tries = 0; tries < 50; tries++) {
      const x = ACTIONS[Math.floor(r() * ACTIONS.length)], y = ACTIONS[Math.floor(r() * ACTIONS.length)];
      if (x === y) continue;
      if (judge([x.w], y.w, y.a) === 'no' && judge([y.w], x.w, x.a) === 'no') return [x, y];
    }
    return [ACTIONS[0], ACTIONS[1]];
  }

  /** Shuffled bag: no repeats until every item has been used. */
  function Bag(items, rand) {
    const r = rand || Math.random;
    let pool = [];
    let last = null;
    this.next = function () {
      if (!pool.length) {
        pool = items.slice();
        for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
        if (pool.length > 1 && pool[pool.length - 1] === last) { const t = pool[0]; pool[0] = pool[pool.length - 1]; pool[pool.length - 1] = t; }
      }
      last = pool.pop();
      return last;
    };
  }

  const pickOne = (arr, r) => arr[Math.floor((r || Math.random)() * arr.length)];
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  const API = { MOVES, moveOf, WORDS, SOUNDS, ACTIONS, RHYMES, PHRASES, PARROT_PROMPTS, GIFTS, PRAISE, TRY_PRAISE,
    FILLER, norm, lev, sk, soundsLike, judge, judgePhrase, actionPair, Bag, pickOne, cap };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.Core = API;
})(typeof window !== 'undefined' ? window : globalThis);
