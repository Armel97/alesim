export type PracticeLang = "en" | "es" | "de" | "it" | "pt";
export type Level = "beginner" | "intermediate" | "advanced";

export const PRACTICE_LANGS: {
  code: PracticeLang;
  labelFr: string;
  labelEn: string;
  flag: string;
}[] = [
  { code: "en", labelFr: "Anglais", labelEn: "English", flag: "🇬🇧" },
  { code: "es", labelFr: "Espagnol", labelEn: "Spanish", flag: "🇪🇸" },
  { code: "de", labelFr: "Allemand", labelEn: "German", flag: "🇩🇪" },
  { code: "it", labelFr: "Italien", labelEn: "Italian", flag: "🇮🇹" },
  { code: "pt", labelFr: "Portugais", labelEn: "Portuguese", flag: "🇵🇹" },
];

export const LEVELS: Level[] = ["beginner", "intermediate", "advanced"];

type Bank = Record<PracticeLang, Record<Level, string[]>>;

export const SENTENCE_BANK: Bank = {
  en: {
    beginner: [
      "Hello, my name is Alex and I am learning English.",
      "I would like a cup of coffee, please.",
      "What time does the train leave tomorrow morning?",
      "The weather is beautiful today in the city.",
      "Could you please repeat that a little more slowly?",
    ],
    intermediate: [
      "I have been working on this project for almost three months.",
      "Although it was raining, we decided to go for a long walk.",
      "She asked me whether I would join them for dinner next Friday.",
      "The report highlights several opportunities for future growth.",
      "I really appreciate the time you took to explain everything.",
    ],
    advanced: [
      "The committee unanimously approved the unprecedented restructuring proposal.",
      "Despite the ambiguity of the instructions, she managed to complete the task flawlessly.",
      "His articulate rebuttal effectively dismantled every counterargument raised.",
      "The manuscript, meticulously annotated, reveals a fascinating linguistic evolution.",
      "Sustainability and profitability need not be mutually exclusive objectives.",
    ],
  },
  es: {
    beginner: [
      "Hola, me llamo Ana y soy de Francia.",
      "¿Dónde está la estación de tren, por favor?",
      "Me gustaría una mesa para dos personas.",
      "Hoy hace mucho calor en la ciudad.",
      "¿Puedes hablar un poco más despacio, por favor?",
    ],
    intermediate: [
      "He estado estudiando español desde hace casi dos años.",
      "Aunque estaba lloviendo, decidimos ir al parque.",
      "Me pregunto si podríamos vernos mañana por la tarde.",
      "La reunión terminó antes de lo previsto.",
      "Agradezco mucho tu ayuda con este proyecto.",
    ],
    advanced: [
      "El desarrollo sostenible exige un compromiso colectivo e ineludible.",
      "A pesar de las dificultades, logró completar la tarea impecablemente.",
      "Su elocuente discurso conmovió profundamente al público asistente.",
      "La ambigüedad de las instrucciones generó cierta confusión inicial.",
      "La transformación digital redefine constantemente nuestras rutinas cotidianas.",
    ],
  },
  de: {
    beginner: [
      "Hallo, ich heiße Julia und komme aus Frankreich.",
      "Wo ist der Bahnhof, bitte?",
      "Ich hätte gern einen Kaffee mit Milch.",
      "Heute ist das Wetter wirklich schön.",
      "Können Sie das bitte etwas langsamer wiederholen?",
    ],
    intermediate: [
      "Ich arbeite seit fast drei Monaten an diesem Projekt.",
      "Obwohl es geregnet hat, sind wir spazieren gegangen.",
      "Sie fragte mich, ob ich sie am Freitag treffen könnte.",
      "Der Bericht zeigt viele Möglichkeiten für die Zukunft.",
      "Ich danke dir sehr für deine Hilfe bei dieser Aufgabe.",
    ],
    advanced: [
      "Der Ausschuss verabschiedete einstimmig den umstrittenen Vorschlag.",
      "Trotz der widrigen Umstände gelang ihr die Aufgabe hervorragend.",
      "Seine überzeugende Rede entkräftete jedes Gegenargument souverän.",
      "Nachhaltigkeit und Wirtschaftlichkeit schließen sich keineswegs aus.",
      "Die sorgfältig kommentierte Handschrift offenbart faszinierende sprachliche Nuancen.",
    ],
  },
  it: {
    beginner: [
      "Ciao, mi chiamo Marco e vengo dalla Francia.",
      "Dov'è la stazione, per favore?",
      "Vorrei un caffè e un cornetto, grazie.",
      "Oggi fa molto caldo in città.",
      "Puoi ripetere più lentamente, per favore?",
    ],
    intermediate: [
      "Lavoro a questo progetto da quasi tre mesi.",
      "Anche se pioveva, siamo andati a fare una passeggiata.",
      "Mi ha chiesto se potevo raggiungerlo domani sera.",
      "La riunione è finita prima del previsto.",
      "Ti ringrazio molto per il tuo aiuto in questo lavoro.",
    ],
    advanced: [
      "Il comitato approvò all'unanimità la proposta di ristrutturazione senza precedenti.",
      "Nonostante l'ambiguità delle istruzioni, portò a termine il compito impeccabilmente.",
      "Il suo discorso articolato smontò ogni possibile controargomentazione.",
      "Sostenibilità e redditività non sono necessariamente obiettivi contrapposti.",
      "La trasformazione digitale ridefinisce continuamente le nostre abitudini quotidiane.",
    ],
  },
  pt: {
    beginner: [
      "Olá, o meu nome é João e sou de França.",
      "Onde fica a estação, por favor?",
      "Gostaria de um café com leite, por favor.",
      "Hoje o tempo está muito bonito.",
      "Pode repetir mais devagar, se faz favor?",
    ],
    intermediate: [
      "Estou a trabalhar neste projeto há quase três meses.",
      "Embora estivesse a chover, decidimos ir passear.",
      "Ela perguntou-me se eu podia jantar com ela na sexta.",
      "O relatório destaca várias oportunidades de crescimento.",
      "Agradeço muito o tempo que dedicou a explicar tudo.",
    ],
    advanced: [
      "O comité aprovou por unanimidade a proposta de reestruturação sem precedentes.",
      "Apesar da ambiguidade das instruções, concluiu a tarefa de forma impecável.",
      "O seu discurso articulado desmontou eficazmente cada contra-argumento.",
      "Sustentabilidade e rentabilidade não são objetivos mutuamente exclusivos.",
      "A transformação digital redefine constantemente as nossas rotinas quotidianas.",
    ],
  },
};

export function sentencesFor(lang: PracticeLang, level: Level): string[] {
  return SENTENCE_BANK[lang][level];
}
