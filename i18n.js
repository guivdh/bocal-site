(() => {
  'use strict';

  const TEXTS = {
    fr: {
      soundOff: 'Couper le son',
      soundOn: 'Activer le son',
      storeDownload: 'Télécharger sur Google Play',
      storeShort: 'Télécharger',
      altHome: "L'accueil de Bocal : six bocaux sur deux étagères, Restos, Recettes, Week-end, Séries, Déco et Cadeaux, puis « Ce qui s'est passé ».",
      altInvite: "La feuille « Inviter dans Restos » avec un QR code, le code K7QM-P3XA et le bouton « Envoyer le lien ».",
      colors: ['Tomate', 'Ciel', 'Soleil', 'Sauge', 'Lavande', 'Rose', 'Mandarine', 'Encre'],
      builderName: 'Recettes',
      myJar: 'Mon bocal',
      emoji: 'Emoji',
      jarRestos: 'Restos',
      jarRecettes: 'Recettes',
      jarWeekend: 'Week-end',
      jarSeries: 'Séries',
      jarDeco: 'Déco',
      jarCadeaux: 'Cadeaux',
      added: (who, title, jar) => `<b>${who}</b> a ajouté « ${title} » dans ${jar} <i>· à l'instant</i>`,
      you: 'toi',
      tagAll: 'Tout',
      tagResto: 'Restaurant',
      tagSortie: 'Sortie',
      tagRecette: 'Recette',
      titles: {
        ramen: 'Le ramen caché derrière Flagey',
        pizza: 'La meilleure pizza napolitaine de Gand ?',
        bao: 'Les bao les plus moelleux de Bruxelles',
        mezze: 'Mezze libanais à partager',
        pancakes: 'Brunch XXL du dimanche',
        sushi: "Sushis : l'adresse qu'on garde pour nous",
        burger: 'Le smash burger dont tout le monde parle',
        wine: 'Le bar à vins où il faut réserver',
        banhmi: 'Bánh mì : 3 adresses testées',
        tacos: 'Tacos de rue à Saint-Gilles',
        icecream: 'Glaces artisanales : notre top 5',
        pizzaRecipe: 'La pâte à pizza de Sam',
      },
      chat: [
        'On se fait un resto samedi ?', 'Vous avez une idée ?', 'Oui ! Regardez ça', 'Trop bien !',
        'Je ramène le dessert', 'Vous avez vu le match ?', 'On dit 19 h ?', 'Qui a un chargeur ?',
        'Regardez mon chat', 'Je peux plus finalement', 'Trop hâte', 'Vous avez vu ma story ?', 'Qui ramène les chips ?',
      ],
      posterSummer: 'ÉTÉ',
      posterJazzDate: 'SAMEDI · 21 H',
      dock: ["C'est parti", 'Suivant', 'Suivant', 'Suivant', 'Plonger dedans'],
    },
    en: {
      soundOff: 'Mute sound',
      soundOn: 'Turn sound on',
      storeDownload: 'Get it on Google Play',
      storeShort: 'Download',
      altHome: 'The Bocal home screen: six jars on two shelves, Eats, Recipes, Weekend, Series, Decor and Gifts, then “What happened”.',
      altInvite: 'The “Invite to Eats” sheet with a QR code, the code K7QM-P3XA and the “Send the link” button.',
      colors: ['Tomato', 'Sky', 'Sun', 'Sage', 'Lavender', 'Pink', 'Tangerine', 'Ink'],
      builderName: 'Recipes',
      myJar: 'My jar',
      emoji: 'Emoji',
      jarRestos: 'Eats',
      jarRecettes: 'Recipes',
      jarWeekend: 'Weekend',
      jarSeries: 'Series',
      jarDeco: 'Decor',
      jarCadeaux: 'Gifts',
      added: (who, title, jar) => `<b>${who}</b> added “${title}” to ${jar} <i>· just now</i>`,
      you: 'you',
      tagAll: 'All',
      tagResto: 'Restaurant',
      tagSortie: 'Outing',
      tagRecette: 'Recipe',
      titles: {
        ramen: 'The hidden ramen spot behind Flagey',
        pizza: 'The best Neapolitan pizza in Ghent?',
        bao: 'The fluffiest bao in Brussels',
        mezze: 'Lebanese mezze to share',
        pancakes: 'XXL Sunday brunch',
        sushi: 'Sushi: the spot we keep to ourselves',
        burger: "The smash burger everyone's talking about",
        wine: 'The wine bar you have to book',
        banhmi: 'Bánh mì: 3 spots tested',
        tacos: 'Street tacos in Saint-Gilles',
        icecream: 'Artisan ice cream: our top 5',
        pizzaRecipe: "Sam's pizza dough",
      },
      chat: [
        'Restaurant on Saturday?', 'Any ideas?', 'Yes! Look at this', 'Love it!',
        "I'll bring dessert", 'Did you see the game?', '7 pm?', 'Anyone got a charger?',
        'Look at my cat', "Can't make it after all", "Can't wait", 'Seen my story?', "Who's bringing chips?",
      ],
      posterSummer: 'SUMMER',
      posterJazzDate: 'SATURDAY · 9 PM',
      dock: ["Let's go", 'Next', 'Next', 'Next', 'Dive in'],
    },
    nl: {
      soundOff: 'Geluid uit',
      soundOn: 'Geluid aan',
      storeDownload: 'Download op Google Play',
      storeShort: 'Downloaden',
      altHome: 'Het startscherm van Bocal: zes bokalen op twee planken, Restos, Recepten, Weekend, Series, Deco en Cadeaus, en daaronder ‘Wat er gebeurde’.',
      altInvite: 'Het blad ‘Uitnodigen in Restos’ met een QR-code, de code K7QM-P3XA en de knop ‘Link versturen’.',
      colors: ['Tomaat', 'Hemel', 'Zon', 'Salie', 'Lavendel', 'Roze', 'Mandarijn', 'Inkt'],
      builderName: 'Recepten',
      myJar: 'Mijn bokaal',
      emoji: 'Emoji',
      jarRestos: 'Restos',
      jarRecettes: 'Recepten',
      jarWeekend: 'Weekend',
      jarSeries: 'Series',
      jarDeco: 'Deco',
      jarCadeaux: 'Cadeaus',
      added: (who, title, jar) => `<b>${who}</b> voegde ‘${title}’ toe aan ${jar} <i>· zonet</i>`,
      you: 'jij',
      tagAll: 'Alles',
      tagResto: 'Restaurant',
      tagSortie: 'Uitstap',
      tagRecette: 'Recept',
      titles: {
        ramen: 'De verborgen ramenzaak achter Flagey',
        pizza: 'De beste Napolitaanse pizza van Gent?',
        bao: 'De zachtste bao van Brussel',
        mezze: 'Libanese mezze om te delen',
        pancakes: 'XXL-zondagsbrunch',
        sushi: 'Sushi: het adresje dat we voor onszelf houden',
        burger: 'De smashburger waar iedereen over praat',
        wine: 'De wijnbar waar je moet reserveren',
        banhmi: 'Bánh mì: 3 adresjes getest',
        tacos: "Straattaco's in Sint-Gillis",
        icecream: 'Ambachtelijk ijs: onze top 5',
        pizzaRecipe: 'Het pizzadeeg van Sam',
      },
      chat: [
        'Zaterdag op restaurant?', 'Iemand een idee?', 'Ja! Kijk hier eens', 'Super!',
        'Ik breng dessert mee', 'Hebben jullie de match gezien?', 'Om 19 uur?', 'Wie heeft er een lader?',
        'Kijk naar mijn kat', 'Ik kan toch niet meer', 'Ik kijk ernaar uit', 'Mijn story al gezien?', 'Wie brengt de chips mee?',
      ],
      posterSummer: 'ZOMER',
      posterJazzDate: 'ZATERDAG · 21 U',
      dock: ['Aan de slag', 'Volgende', 'Volgende', 'Volgende', 'Duik erin'],
    },
  };

  const LANGS = ['fr', 'en', 'nl'];
  const lang = LANGS.includes(document.documentElement.lang) ? document.documentElement.lang : 'fr';
  const dict = TEXTS[lang];
  const KEY = 'bocal.lang';

  window.BocalI18n = {
    lang,
    base: lang === 'fr' ? '' : '../',
    screens: lang === 'fr' ? 'screens' : `screens-${lang}`,
    t: (key) => (key in dict ? dict[key] : TEXTS.fr[key]),
  };

  const read = () => { try { return localStorage.getItem(KEY); } catch (_) { return null; } };
  const write = (v) => { try { localStorage.setItem(KEY, v); } catch (_) {} };

  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('[data-lang]');
    if (a) write(a.dataset.lang);
    for (const d of document.querySelectorAll('details.langs[open]')) if (!d.contains(e.target)) d.open = false;
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') for (const d of document.querySelectorAll('details.langs[open]')) d.open = false;
  });

  const bot = /bot|crawl|spider|slurp|preview|lighthouse/i.test(navigator.userAgent) || navigator.webdriver;
  if (lang !== 'fr' || bot || location.search.includes('p=')) return;
  let want = read();
  if (!want) {
    const prefs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'fr']).map((l) => l.slice(0, 2).toLowerCase());
    want = prefs.find((l) => LANGS.includes(l)) || 'en';
  }
  if (want !== 'fr' && LANGS.includes(want)) location.replace(`${want}/${location.search}${location.hash}`);
})();
