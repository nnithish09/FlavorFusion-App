// Visual identity for dishes that image models routinely get wrong.
//
// Why this exists: text-to-image models map an unfamiliar dish NAME to the nearest thing they
// know (upma -> plain rice, poha -> rice, dhokla -> cake). Describing what the dish LOOKS like
// (grain size, consistency, colour, shape, vessel) gives the model something concrete to draw.
//
// Rules for editing this list:
//  - Describe appearance only, in positive terms. Image models tend to draw whatever is named,
//    so never write "not rice" or "no cake"; describe the real texture instead.
//  - Order matters: more specific patterns must come BEFORE general ones
//    (e.g. "sabudana khichdi" before "khichdi").
//  - Keep each entry under ~330 characters so the final prompt stays inside the 2,048 limit.

const D = (pattern, look) => ({ pattern, look });

export const DISHES = [
  // ---- South Indian breakfast ----
  D(/\bupma\b|\buppittu\b|\bupit\b/i, "soft, moist, cohesive mound of cooked semolina (rava) with a fine, slightly granular porridge-like texture, pale golden-beige in colour, flecked with black mustard seeds, curry leaves, green chilli, diced carrot, peas and a few cashews, served in a small heap on a steel plate or white bowl with a spoon of ghee on top"),
  D(/\bbisi\s*bele\b/i, "thick, glossy, deep orange-brown porridge-like rice and lentil mash with vegetables, finished with ghee, fried cashews and crisp boondi, served in a steel bowl"),
  D(/\bpongal\b/i, "soft, creamy, pale-yellow mash of rice and moong dal, glistening with ghee, studded with whole black peppercorns, cumin and cashews, served in a mound on a banana leaf with coconut chutney and sambar"),
  D(/\bmedu\s*vada\b|\bvada\b(?!\s*pav)/i, "ring-shaped golden-brown fried lentil doughnuts with a crisp, craggy surface and a hole in the middle, served on a steel plate with coconut chutney and sambar"),
  D(/\b(rava|sooji|suji)\s*idli\b/i, "soft, pale-golden, round steamed semolina cakes in the classic idli shape, dotted with mustard seeds, cashews and curry leaves, served with coconut chutney and sambar"),
  D(/\b(rava|sooji|suji)\s*dosa\b/i, "large, thin, very crisp, golden lacy-netted crepe of semolina batter with onion, green chilli and cumin, folded on a steel plate with coconut chutney and sambar"),
  D(/\bidli\b|\bidly\b/i, "round, pillowy, soft white steamed rice-and-lentil cakes with a smooth surface, served in a group of three on a plate with coconut chutney and orange sambar"),
  D(/\bmasala\s*dosa\b/i, "very large, thin, crisp, golden-brown rolled crepe made of fermented batter, filled with a yellow potato-onion masala, served on a steel plate with coconut chutney and sambar"),
  D(/\bdosa\b|\bdosai\b|\bpesarattu\b/i, "large, thin, crisp, golden-brown crepe made of fermented batter, folded or rolled, with lacy brown edges, served on a steel plate with coconut chutney and sambar"),
  D(/\buttapam\b|\butthappam\b/i, "thick, soft round pancake of fermented batter with a lightly crisp base, topped with chopped onion, tomato, green chilli and coriander, served with chutney"),
  D(/\bappam\b|\bhoppers?\b/i, "bowl-shaped fermented rice-batter pancake with a soft, white, spongy centre and thin lacy crisp edges, served with vegetable stew"),
  D(/\bputtu\b/i, "cylindrical steamed log of crumbly white rice flour layered with grated coconut, served with chickpea curry or banana"),
  D(/\bsambar\b|\bsambhar\b/i, "thick, orange-yellow lentil and vegetable stew with visible drumstick, pumpkin, carrot and shallots, tempered with mustard seeds and curry leaves, served in a steel bowl"),
  D(/\brasam\b/i, "thin, translucent, tangy tomato-tamarind peppery soup of reddish-brown colour with mustard seeds, curry leaves and coriander floating on top, served in a small steel bowl or tumbler"),
  D(/\bcurd\s*rice\b|\bthayir\s*sadam\b|\bcurd\s*sadam\b/i, "creamy, soft white rice mashed with yoghurt, tempered with mustard seeds, curry leaves, green chilli and grated carrot, pomegranate seeds on top, served in a bowl"),
  D(/\blemon\s*rice\b|\bchitranna\b/i, "fluffy separate grains of yellow turmeric rice with peanuts, curry leaves, mustard seeds and green chilli, with a lemon wedge on the side"),
  D(/\btamarind\s*rice\b|\bpuliyogare\b|\bpuliyodarai\b/i, "glossy dark-brown tangy rice coated in tamarind paste, with roasted peanuts, sesame and curry leaves, served on a banana leaf"),
  D(/\bavial\b|\baviyal\b/i, "mixed vegetables in a thick, pale, coconut-yoghurt sauce, with long batons of yam, raw banana, drumstick and carrot, finished with curry leaves and coconut oil"),
  D(/\brava\s*kesari\b|\bkesari\s*bath\b|\bsooji\s*halwa\b|\bsuji\s*halwa\b|\bsheera\b|\bsooji\s*ka\s*halwa\b/i, "soft, glossy, saffron-orange pudding of roasted semolina with ghee, studded with fried cashews, raisins and cardamom, served as a small mound"),
  D(/\bpayasam\b|\bpayasa\b/i, "creamy, pale ivory-to-golden sweet milk pudding with soft vermicelli or rice, garnished with ghee-fried cashews and raisins, served in a small bowl"),

  // ---- Breakfast and snacks across India ----
  D(/\bpoha\b|\bpohe\b|\baval\b|\bflattened\s*rice\b/i, "soft, light, yellow turmeric-coloured flattened rice flakes (thin, flat, irregular flakes, not long grains) with peanuts, curry leaves, green chilli, onion, topped with fresh coriander, sev and a lemon wedge, served on a plate"),
  D(/\bsabudana\s*khichdi\b|\bsabudana\b|\bsago\b/i, "glossy, translucent, pearl-like round tapioca balls tossed with roasted peanuts, cumin and green chilli, pale and slightly sticky, served on a plate with a lemon wedge"),
  D(/\bdhokla\b|\bkhaman\b/i, "soft, spongy, pale-yellow steamed chickpea-flour squares, cut in neat diamonds, with a mustard-seed, green-chilli and curry-leaf tempering, grated coconut and coriander on top, served with green chutney"),
  D(/\bkhandvi\b/i, "thin, delicate, yellow rolled chickpea-flour-and-yoghurt scrolls, tempered with mustard seeds and topped with coconut and coriander"),
  D(/\bthepla\b/i, "thin, soft, round flatbreads of spiced wheat and fenugreek with brown cooked spots, folded in quarters, served with yoghurt and pickle"),
  D(/\bchilla\b|\bcheela\b/i, "thin, golden-yellow savoury lentil or chickpea-flour pancake, folded over a vegetable filling, served with green chutney"),
  D(/\bsamosa\b/i, "golden-brown, crisp, flaky deep-fried triangular pastry filled with spiced potato and peas, served with green and tamarind chutneys"),
  D(/\bkachori\b/i, "round, puffed, golden-brown crisp deep-fried pastry with a flaky crust filled with spiced lentils, served with tangy potato curry or chutney"),
  D(/\bpakora\b|\bpakoda\b|\bbhajiya\b|\bbhajji\b/i, "irregular crisp golden-brown fritters of vegetables coated in chickpea-flour batter, served hot with green chutney"),
  D(/\bvada\s*pav\b/i, "round soft bread bun filled with a spiced, golden-fried potato patty, with red garlic chutney and green chutney and a fried green chilli on the side"),
  D(/\bpav\s*bhaji\b/i, "thick, bright red-orange mashed vegetable curry topped with a pat of butter and chopped onion and coriander, served with buttery toasted soft bread rolls and a lemon wedge"),
  D(/\bmisal\b/i, "spicy sprouted-moth-bean curry with a red oil layer, topped with crunchy farsan, chopped onion and coriander, served with bread rolls and lemon"),
  D(/\bpani\s*puri\b|\bgolgappa\b|\bgol\s*gappe\b|\bpuchka\b/i, "small, round, hollow, crisp golden puris filled with spiced potato and chickpeas, served with a glass of green mint water"),
  D(/\bbhel\s*puri\b|\bbhel\b|\bsev\s*puri\b|\bchaat\b/i, "colourful heap of puffed rice, crisp sev, chopped onion, tomato, potato, coriander, with green and tamarind chutneys drizzled over, served in a small bowl or paper cone"),

  // ---- Breads and rice ----
  D(/\baloo\s*paratha\b|\bparatha\b|\bparantha\b/i, "round, golden-brown, flaky, griddle-cooked layered flatbread glistening with ghee, stuffed with spiced filling, served with a pat of butter, yoghurt and pickle"),
  D(/\bnaan\b|\bkulcha\b/i, "oval, puffed, soft tandoor-baked flatbread with charred brown blisters, brushed with butter and flecks of garlic or coriander"),
  D(/\bchapati\b|\broti\b|\bphulka\b/i, "round, thin, soft whole-wheat flatbread with light brown toasted spots, stacked and folded in a cloth-lined basket"),
  D(/\bbiryani\b|\bbiriyani\b/i, "fragrant, long-grain basmati rice layered with spiced meat or vegetables, streaked saffron-yellow and white, topped with fried onions, mint and coriander, served in a handi or copper pot with raita"),
  D(/\bpulao\b|\bpilaf\b|\bpulav\b/i, "fluffy, separate long grains of basmati rice with whole spices, peas, carrots and fried onions, lightly golden, served in a bowl"),
  D(/\bkhichdi\b|\bkhichri\b|\bkhichadi\b/i, "soft, creamy, porridge-like yellow mash of rice and lentils with a pool of ghee on top, served in a bowl with papad and pickle"),

  // ---- Curries and dals ----
  D(/\bpaneer\s*butter\s*masala\b|\bpaneer\s*makhani\b|\bbutter\s*paneer\b/i, "cubes of white paneer in a smooth, rich, creamy orange-red tomato gravy with a swirl of cream and butter, garnished with coriander, served in a bowl with naan"),
  D(/\bpalak\s*paneer\b|\bsaag\s*paneer\b/i, "cubes of white paneer in a thick, smooth, deep-green spinach gravy with a swirl of cream, served in a bowl"),
  D(/\bchole\b|\bchana\s*masala\b|\bchhole\b/i, "plump chickpeas in a thick, dark-brown, glossy spiced gravy, topped with sliced onion, ginger and coriander, served with bhatura or rice"),
  D(/\brajma\b/i, "kidney beans in a thick, deep red-brown gravy, garnished with coriander, served with rice"),
  D(/\bdal\s*makhani\b|\bdaal\s*makhani\b/i, "creamy, dark-brown black lentil stew with a swirl of cream and a knob of butter, served in a bowl"),
  D(/\bdal\s*tadka\b|\bdal\s*fry\b|\bdaal\b|\bdal\b/i, "bright yellow, soft, thick lentil soup, finished with a sizzling red-chilli and garlic tempering on top, garnished with coriander, served in a bowl with rice"),
  D(/\bkadhi\b|\bkadi\b/i, "smooth, pale-yellow, tangy yoghurt and chickpea-flour curry with a red chilli tempering on top and small fritters, served in a bowl"),
  D(/\bbutter\s*chicken\b|\bmurgh\s*makhani\b/i, "pieces of tandoori chicken in a silky, creamy, orange-red tomato-butter gravy with a swirl of cream, served with naan"),
  D(/\bchicken\s*tikka\b|\btandoori\b|\btikka\b/i, "charred, deep red-orange marinated chunks of meat or paneer on skewers, with onion rings, lemon wedges and mint chutney"),
  D(/\bkorma\b|\bkurma\b/i, "pieces simmered in a rich, creamy, pale-gold to ivory gravy of yoghurt, nuts and spices, garnished with fried onions and almonds"),
  D(/\bkeema\b|\bkheema\b/i, "crumbled spiced minced meat cooked dry and glossy with peas, in a deep reddish-brown colour, garnished with coriander, served with pav or roti"),
  D(/\bfish\s*curry\b|\bmeen\s*curry\b|\bmeen\s*moilee\b/i, "pieces of fish in a vivid red-orange tangy coconut or tamarind gravy with curry leaves, served in a clay or steel pot"),
  D(/\baloo\s*gobi\b|\baloo\s*gobhi\b/i, "dry, golden-yellow stir-fry of cauliflower florets and potato chunks with turmeric, cumin and coriander"),
  D(/\bbaingan\s*bharta\b|\bbaigan\s*bharta\b|\bbrinjal\s*bharta\b/i, "smoky, soft, mashed roasted aubergine cooked with onion, tomato and green chilli, in a rustic, dark, textured mash garnished with coriander"),
  D(/\bbhindi\b|\bokra\b/i, "dry stir-fry of green okra pieces with onion and spices, lightly golden and glossy, not slimy"),
  D(/\braita\b/i, "cool, creamy white yoghurt with finely grated cucumber, onion or boondi, sprinkled with roasted cumin powder and red chilli powder, served in a small bowl"),

  // ---- Sweets and drinks ----
  D(/\bgulab\s*jamun\b/i, "round, deep brown, glossy, soft milk-solid dumplings soaked in clear, shiny sugar syrup, served in a bowl with pistachio slivers"),
  D(/\bjalebi\b/i, "crisp, bright orange-yellow spirals of fried batter glistening with sugar syrup, served in a pile"),
  D(/\bkheer\b/i, "creamy, ivory-white rice pudding with a few cardamom and saffron strands, garnished with chopped pistachios and almonds, served in a small bowl"),
  D(/\bladoo\b|\bladdu\b|\bladdoo\b/i, "round, golden-yellow sweet balls with a slightly granular texture, topped with a pistachio, served on a small plate"),
  D(/\bgajar\s*(ka\s*)?halwa\b|\bcarrot\s*halwa\b/i, "deep orange-red, soft, moist grated-carrot pudding glistening with ghee, garnished with chopped nuts and a few saffron strands"),
  D(/\bmasala\s*chai\b|\bchai\b/i, "milky, light-brown spiced tea in a small glass or clay cup, with a few whole spices and steam rising"),
  D(/\blassi\b/i, "thick, creamy, pale-white to pale-pink yoghurt drink in a tall glass, topped with a layer of malai and pistachios"),
  // ---- Technique-heavy dishes (landing-page showcase) ----
  D(/\bchingri\s*(malai|malaikari)\b|\bprawn\s*malai\b|\bprawn\s*malaikari\b/i, "large, plump pink-orange prawns in a pale, creamy, golden-ivory coconut-milk gravy that glistens with a little ghee, with whole green chillies, a bay leaf and cardamom pods, served in a small brass or white bowl with steamed rice alongside"),
  D(/\bgalouti\b|\bgalawati\b/i, "small, round, flat, very tender golden-brown minced-meat patties with a seared crisp edge, served on a small round flaky paratha with sliced onion rings, green chutney and lemon wedges"),
  D(/\bxiao\s*long\s*bao\b|\bxiaolongbao\b|\bsoup\s*dumplings?\b/i, "small, pleated, translucent-skinned steamed soup dumplings, each with a twisted knot at the top, resting in a round bamboo steamer lined with paper and glistening with soup, with a small dish of black vinegar and ginger slivers"),
  D(/\bpaella\b/i, "a wide, shallow, black iron paella pan filled with an even layer of golden saffron-yellow short-grain rice, topped with chicken, prawns or mussels, green beans and lemon wedges, with a darker toasted crust at the edges of the pan"),
  D(/\bmole\s*poblano\b|\bmole\b/i, "pieces of chicken covered in a thick, glossy, dark mahogany-brown mole sauce, generously sprinkled with toasted sesame seeds, served with red rice and warm corn tortillas"),
  D(/\bsouffl[eé](?![a-z])/i, "a tall, golden-brown, puffed soufflé rising well above the rim of a round white ramekin, with a domed crown and a soft, creamy interior, served immediately on a small plate"),
];

/** Returns the visual description of the first dictionary entry matching the recipe title, or "". */
export function lookupDishLook(title) {
  const hit = DISHES.find((d) => d.pattern.test(String(title || "")));
  return hit ? hit.look : "";
}
