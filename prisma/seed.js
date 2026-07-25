// Seed für den dreistufigen Leistungskatalog (Block 2/5): feste Raumbereiche
// und Elementgruppen (aus dem Auftrag wörtlich übernommen) plus eine
// Startmenge an Katalogeinträgen, abgeleitet aus den bisherigen
// Freitext-Formulierungen in src/templates/checklistAreas.js - damit Block 5
// (Kundenmaske/Objekte/LV-Übertragung) gegen echte Daten testbar ist. Die
// vollständige Katalogpflege ist bewusst nicht Teil dieses Blocks.
//
// Idempotent (upsert über den Namen) - kann gefahrlos mehrfach laufen.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ROOM_AREAS = [
  'Sanitär',
  'Flure und Treppenhäuser',
  'Büros',
  'Küchen und Teeküchen',
  'Speisesaal und Aufenthaltsraum',
  'Lager und Archiv',
  'Außenbereich',
];

const ELEMENT_GROUPS = ['Boden', 'Wand', 'Abfall', 'Inventar'];

// { elementGroup, gegenstand, verb, zusatz?, synonyme }
const CATALOG_ITEMS = [
  { group: 'Boden', gegenstand: 'Hartboden', verb: 'FEUCHT_WISCHEN', synonyme: ['Hartböden wischen'] },
  {
    group: 'Boden',
    gegenstand: 'Textilbelag',
    verb: 'ABSAUGEN',
    synonyme: ['Teppich saugen', 'Textilbeläge saugen'],
  },
  {
    group: 'Boden',
    gegenstand: 'Fußleisten',
    verb: 'FEUCHT_WISCHEN',
    synonyme: ['Sockelleisten wischen'],
  },
  {
    group: 'Wand',
    gegenstand: 'Innenverglasung',
    verb: 'FLECKENFREI_REINIGEN',
    zusatz: 'Fingerabdrücke und Schlieren',
    synonyme: ['Glastüren reinigen', 'Trennwände reinigen'],
  },
  {
    group: 'Wand',
    gegenstand: 'Lichtschalter und Steckdosenrahmen',
    verb: 'DESINFIZIEREND_REINIGEN',
    synonyme: ['Schalter abwischen'],
  },
  {
    group: 'Wand',
    gegenstand: 'Türklinken',
    verb: 'GRIFFSPUREN_ENTFERNEN',
    synonyme: ['Türgriffe reinigen'],
  },
  {
    group: 'Abfall',
    gegenstand: 'Abfallbehälter',
    verb: 'ENTLEEREN_UND_ENTSORGEN',
    zusatz: 'inkl. Austausch der Beutel',
    synonyme: ['Papierkorb leeren', 'Mülleimer leeren'],
  },
  {
    group: 'Inventar',
    gegenstand: 'Sanitärobjekte (WC, Waschbecken, Armaturen)',
    verb: 'DESINFIZIEREND_REINIGEN',
    synonyme: ['WC reinigen', 'Waschbecken reinigen'],
  },
  {
    group: 'Inventar',
    gegenstand: 'Armaturen',
    verb: 'ENTKALKEN',
    synonyme: ['Wasserhähne entkalken'],
  },
  {
    group: 'Inventar',
    gegenstand: 'Arbeits- und Schreibtische',
    verb: 'FEUCHT_WISCHEN',
    zusatz: 'nur freigeräumte Flächen',
    synonyme: ['Tische abwischen'],
  },
  {
    group: 'Inventar',
    gegenstand: 'Mobiliar, Lampen, Heizkörper',
    verb: 'ENTSTAUBEN',
    synonyme: ['Staub wischen', 'Spinnweben entfernen'],
  },
];

async function main() {
  const roomAreaIds = {};
  for (const [i, name] of ROOM_AREAS.entries()) {
    const existing = await prisma.roomArea.findFirst({ where: { name } });
    const row = existing
      ? await prisma.roomArea.update({ where: { id: existing.id }, data: { sortOrder: i } })
      : await prisma.roomArea.create({ data: { name, sortOrder: i } });
    roomAreaIds[name] = row.id;
  }
  console.log(`Raumbereiche: ${ROOM_AREAS.length} angelegt/aktualisiert`);

  const elementGroupIds = {};
  for (const [i, name] of ELEMENT_GROUPS.entries()) {
    const existing = await prisma.elementGroup.findFirst({ where: { name } });
    const row = existing
      ? await prisma.elementGroup.update({ where: { id: existing.id }, data: { sortOrder: i } })
      : await prisma.elementGroup.create({ data: { name, sortOrder: i } });
    elementGroupIds[name] = row.id;
  }
  console.log(`Elementgruppen: ${ELEMENT_GROUPS.length} angelegt/aktualisiert`);

  let catalogCount = 0;
  for (const item of CATALOG_ITEMS) {
    const elementGroupId = elementGroupIds[item.group];
    const existing = await prisma.serviceCatalogItem.findFirst({
      where: { elementGroupId, gegenstand: item.gegenstand, verb: item.verb },
    });
    if (!existing) {
      await prisma.serviceCatalogItem.create({
        data: {
          elementGroupId,
          gegenstand: item.gegenstand,
          verb: item.verb,
          zusatz: item.zusatz || null,
          synonyme: item.synonyme || [],
        },
      });
      catalogCount++;
    }
  }
  console.log(`Katalogeinträge: ${catalogCount} neu angelegt (Rest bereits vorhanden)`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
