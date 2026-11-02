/**
 * Contenu des pages légales ALESIM.
 * Modifiable ici sans toucher au code des pages (un seul endroit à éditer).
 * Les mentions entre crochets [ ... ] sont des PLACEHOLDERS à compléter par l'éditeur.
 */

export type LegalBlock =
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "table"; head: string[]; rows: string[][] };

export type LegalSection = {
  id: string;
  heading: string;
  blocks: LegalBlock[];
};

export type LegalDoc = {
  slug: "confidentialite" | "cgu" | "cookies" | "mentions-legales" | "rgpd";
  title: string;
  lead: string;
  updatedAt: string; // ISO
  sections: LegalSection[];
};

export const EDITOR = {
  name: "[RAISON SOCIALE DE L'ÉDITEUR]",
  legalForm: "[FORME JURIDIQUE — ex. SAS au capital de X €]",
  address: "[ADRESSE DU SIÈGE SOCIAL]",
  siret: "[SIRET / RCS]",
  vat: "[N° TVA INTRACOMMUNAUTAIRE]",
  publisher: "[NOM DU DIRECTEUR DE PUBLICATION]",
  email: "[contact@alesimspeak.dev]",
  privacyEmail: "[privacy@alesimspeak.dev]",
  dpo: "[NOM ET CONTACT DU DPO — ou : aucun DPO désigné à ce jour]",
  phone: "[TÉLÉPHONE]",
};

const UPDATED = "2026-07-30";

export const PRIVACY: LegalDoc = {
  slug: "confidentialite",
  title: "Politique de confidentialité",
  lead: "Comment ALESIM collecte, utilise et protège vos données personnelles, y compris vos enregistrements audio, vidéo et vos CV.",
  updatedAt: UPDATED,
  sections: [
    {
      id: "responsable",
      heading: "1. Responsable de traitement",
      blocks: [
        {
          type: "p",
          text: `L'application ALESIM (« ALESIM », « nous ») est éditée par ${EDITOR.name}, ${EDITOR.legalForm}, dont le siège social est situé ${EDITOR.address}, immatriculée sous le numéro ${EDITOR.siret}.`,
        },
        {
          type: "p",
          text: `${EDITOR.name} agit en qualité de responsable de traitement au sens du Règlement (UE) 2016/679 (RGPD) et de la loi « Informatique et Libertés » du 6 janvier 1978 modifiée. Contact : ${EDITOR.privacyEmail}.`,
        },
      ],
    },
    {
      id: "donnees",
      heading: "2. Données personnelles collectées",
      blocks: [
        {
          type: "p",
          text: "Nous collectons uniquement les données nécessaires au fonctionnement du service :",
        },
        {
          type: "ul",
          items: [
            "Données de compte : adresse email, nom ou prénom d'affichage, identifiant technique, mot de passe (stocké sous forme chiffrée / haché) ou identifiant de connexion Google.",
            "Données d'usage et de progression : leçons réalisées, quiz, séries (streaks), badges, statistiques de débit, clarté, hésitations, préférences de thèmes et objectifs.",
            "Enregistrements audio : votre voix, enregistrée à votre initiative lors des exercices oraux, ainsi que la transcription texte associée.",
            "Mesures vidéo : l'analyse visuelle (posture, regard, stabilité du cadrage, gestuelle) s'exécute intégralement dans votre navigateur. La vidéo brute n'est ni transmise, ni enregistrée, ni conservée par ALESIM : seules les mesures agrégées (scores et moyennes par séance) sont enregistrées, et la piste audio suit le régime des enregistrements audio si vous l'activez.",
            "CV et documents importés : fichiers PDF, DOCX ou images que vous téléversez pour l'analyse de CV, ainsi que le texte extrait (nom, expériences, coordonnées éventuellement contenues dans le document).",
            "Données techniques : type d'appareil, navigateur, langue, journaux d'erreurs, identifiants d'abonnement aux notifications push.",
          ],
        },
        {
          type: "p",
          text: "Les enregistrements audio et vidéo, ainsi que les CV, peuvent contenir des informations sensibles. Nous vous invitons à ne pas y faire figurer de données que vous ne souhaitez pas traiter (données de santé, opinions, données relatives à des tiers).",
        },
      ],
    },
    {
      id: "finalites",
      heading: "3. Finalités et bases légales",
      blocks: [
        {
          type: "table",
          head: ["Finalité", "Données", "Base légale"],
          rows: [
            [
              "Création et gestion du compte",
              "Email, nom, identifiants",
              "Exécution du contrat (art. 6.1.b RGPD)",
            ],
            [
              "Fourniture des leçons et suivi de progression",
              "Données d'usage et de progression",
              "Exécution du contrat",
            ],
            [
              "Analyse vocale (débit, clarté, hésitations, prononciation)",
              "Enregistrements audio, transcriptions",
              "Consentement (art. 6.1.a RGPD), révocable à tout moment",
            ],
            [
              "Analyse posturale et d'éloquence face caméra",
              "Mesures visuelles agrégées uniquement (aucune vidéo brute conservée), audio le cas échéant",
              "Consentement",
            ],
            ["Analyse de CV et recommandations", "Fichier CV, texte extrait", "Consentement"],
            [
              "Notifications et rappels de motivation",
              "Abonnement push, horaires choisis",
              "Consentement",
            ],
            [
              "Amélioration du service, statistiques agrégées, sécurité",
              "Données techniques, données anonymisées",
              "Intérêt légitime (art. 6.1.f RGPD)",
            ],
          ],
        },
        {
          type: "p",
          text: "Nous n'utilisons pas vos enregistrements ni vos CV pour entraîner des modèles d'intelligence artificielle sans votre consentement explicite et distinct.",
        },
      ],
    },
    {
      id: "conservation",
      heading: "4. Durées de conservation",
      blocks: [
        {
          type: "table",
          head: ["Donnée", "Durée de conservation"],
          rows: [
            [
              "Compte utilisateur",
              "Toute la durée du compte, puis 30 jours après suppression (sauvegardes)",
            ],
            ["Données de progression et statistiques", "3 ans à compter de la dernière activité"],
            [
              "Enregistrements audio",
              "Non conservés : l'audio brut est transmis à nos prestataires d'analyse, traité à la volée puis supprimé (au maximum 30 jours de rétention sécurité chez le prestataire)",
            ],
            [
              "Transcriptions et résultats d'analyse",
              "Sur votre appareil sans compte ; avec un compte, conservés jusqu'à suppression de la séance ou du compte",
            ],
            [
              "Vidéo brute",
              "Jamais conservée : le flux reste dans votre navigateur et disparaît à la fin de la séance",
            ],
            [
              "Mesures vidéo agrégées (regard, posture, stabilité)",
              "6 mois maximum, puis suppression automatique",
            ],
            [
              "CV importés et texte extrait",
              "12 mois maximum, ou suppression immédiate sur demande",
            ],
            [
              "Compte inactif",
              "Suppression automatique du compte et des contenus après 24 mois d'inactivité, après notification par email",
            ],
            ["Journaux techniques et de sécurité", "12 mois"],
          ],
        },
        {
          type: "p",
          text: "Précision importante : la transcription et l'analyse pédagogique de vos enregistrements audio sont réalisées sur des serveurs distants (prestataires d'IA), et non sur votre appareil. Seule l'analyse visuelle du module Vidéo (posture, regard, gestuelle) est calculée localement. Vos enregistrements, transcriptions et CV ne sont jamais utilisés pour entraîner des modèles d'intelligence artificielle, ni revendus, ni partagés à des fins publicitaires.",
        },
      ],
    },
    {
      id: "destinataires",
      heading: "5. Destinataires et sous-traitants",
      blocks: [
        {
          type: "p",
          text: "Vos données sont accessibles aux seules personnes habilitées de l'éditeur et aux sous-traitants suivants, liés par un accord de sous-traitance conforme à l'article 28 du RGPD :",
        },
        {
          type: "table",
          head: ["Prestataire", "Rôle", "Données concernées", "Localisation"],
          rows: [
            [
              "Supabase / hébergeur de base de données",
              "Hébergement du compte, de la progression et des contenus",
              "Compte, progression, métadonnées",
              "[UE — région à préciser]",
            ],
            [
              "Google / Firebase",
              "Authentification Google, notifications, mesure d'audience éventuelle",
              "Identifiants, données techniques",
              "UE / États-Unis",
            ],
            [
              "OpenAI (Whisper, GPT)",
              "Transcription et analyse des enregistrements audio",
              "Audio, transcription",
              "États-Unis",
            ],
            [
              "Google (Gemini)",
              "Analyse pédagogique, synthèse vidéo, analyse de CV",
              "Transcriptions, mesures, texte du CV",
              "UE / États-Unis",
            ],
            [
              "Anthropic (Claude)",
              "Génération de retours et de plans d'entraînement",
              "Transcriptions et métriques",
              "États-Unis",
            ],
            [
              "Microsoft Azure Speech",
              "Synthèse et reconnaissance vocale (le cas échéant)",
              "Audio, texte",
              "UE / États-Unis",
            ],
            [
              "jsDelivr (cdn.jsdelivr.net) et Google Storage (storage.googleapis.com)",
              "Téléchargement des modèles d'analyse visuelle MediaPipe exécutés dans votre navigateur",
              "Adresse IP et données techniques de connexion au CDN (aucune vidéo, aucune image)",
              "UE / États-Unis",
            ],
          ],
        },
        {
          type: "p",
          text: "Vos enregistrements peuvent donc transiter par ces services le temps strictement nécessaire à l'analyse. Le module vidéo fait exception : votre navigateur télécharge les modèles d'analyse depuis les CDN cdn.jsdelivr.net et storage.googleapis.com, mais aucune image ni vidéo ne leur est envoyée. Nous ne vendons ni ne louons vos données personnelles à des tiers.",
        },
      ],
    },
    {
      id: "transferts",
      heading: "6. Transferts hors Union européenne",
      blocks: [
        {
          type: "p",
          text: "Certains prestataires sont établis aux États-Unis. Ces transferts sont encadrés par les clauses contractuelles types de la Commission européenne (décision 2021/914) et, lorsque le prestataire y est certifié, par le EU-U.S. Data Privacy Framework, complétés par des mesures techniques supplémentaires (chiffrement en transit, minimisation, pseudonymisation).",
        },
      ],
    },
    {
      id: "droits",
      heading: "7. Vos droits",
      blocks: [
        {
          type: "ul",
          items: [
            "Droit d'accès à vos données et d'obtention d'une copie.",
            "Droit de rectification des données inexactes.",
            "Droit à l'effacement (« droit à l'oubli »), notamment de vos enregistrements et CV.",
            "Droit à la portabilité : export de votre historique et de vos résultats aux formats PDF et CSV depuis l'application.",
            "Droit d'opposition et droit à la limitation du traitement.",
            "Droit de retirer votre consentement à tout moment, sans effet rétroactif.",
            "Droit de définir des directives relatives au sort de vos données après votre décès.",
          ],
        },
        {
          type: "p",
          text: `Pour exercer vos droits : depuis l'application (Profil → Informations légales → gestion des données) ou par email à ${EDITOR.privacyEmail}. Nous répondons dans un délai d'un mois. Délégué à la protection des données : ${EDITOR.dpo}.`,
        },
        {
          type: "p",
          text: "Vous pouvez introduire une réclamation auprès de la CNIL — 3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07 — www.cnil.fr.",
        },
      ],
    },
    {
      id: "securite",
      heading: "8. Sécurité",
      blocks: [
        {
          type: "ul",
          items: [
            "Chiffrement des communications en transit (HTTPS/TLS) et chiffrement au repos des bases de données et du stockage de fichiers.",
            "Cloisonnement par utilisateur : politiques d'accès au niveau de la base (Row Level Security) empêchant l'accès aux contenus d'autrui.",
            "Accès interne restreint aux personnes habilitées, journalisation des accès.",
            "Traitement local sur l'appareil dès que possible (analyse de posture, OCR des CV) afin de limiter les transferts.",
            "Suppression automatique programmée des contenus sensibles selon les durées ci-dessus.",
          ],
        },
      ],
    },
    {
      id: "mineurs",
      heading: "9. Mineurs",
      blocks: [
        {
          type: "p",
          text: "ALESIM est réservé aux personnes âgées d'au moins 15 ans. En-deçà, l'inscription requiert le consentement du ou des titulaires de l'autorité parentale.",
        },
      ],
    },
    {
      id: "modifs",
      heading: "10. Modification de la présente politique",
      blocks: [
        {
          type: "p",
          text: "Toute modification substantielle vous sera notifiée par email ou dans l'application au moins 15 jours avant son entrée en vigueur. La date de dernière mise à jour figure en haut de cette page.",
        },
      ],
    },
  ],
};

export const TERMS: LegalDoc = {
  slug: "cgu",
  title: "Conditions générales d'utilisation",
  lead: "Les règles d'accès et d'utilisation de l'application ALESIM.",
  updatedAt: UPDATED,
  sections: [
    {
      id: "objet",
      heading: "1. Objet",
      blocks: [
        {
          type: "p",
          text: `Les présentes conditions générales d'utilisation (« CGU ») régissent l'accès et l'utilisation de l'application ALESIM, éditée par ${EDITOR.name}. Toute utilisation du service vaut acceptation pleine et entière des CGU.`,
        },
        {
          type: "p",
          text: "ALESIM est un service d'entraînement à la communication orale : exercices guidés, analyse de la voix, travail de la confiance en soi, pratique de langues étrangères, analyse de posture et analyse de CV.",
        },
      ],
    },
    {
      id: "acces",
      heading: "2. Conditions d'accès",
      blocks: [
        {
          type: "ul",
          items: [
            "L'utilisateur doit être âgé d'au moins 15 ans (accord parental requis en dessous de 18 ans si la législation locale l'exige).",
            "La création d'un compte (email/mot de passe ou connexion Google) est nécessaire pour accéder aux leçons, à la progression et aux modules d'analyse.",
            "L'utilisateur garantit l'exactitude des informations fournies et reste responsable de la confidentialité de ses identifiants.",
            "L'accès nécessite un appareil compatible, un micro et, pour le module vidéo, une caméra ; certaines fonctionnalités requièrent une connexion Internet.",
          ],
        },
      ],
    },
    {
      id: "fonctionnalites",
      heading: "3. Description des fonctionnalités",
      blocks: [
        {
          type: "ul",
          items: [
            "Leçons quotidiennes personnalisées, quiz, badges et séries de progression.",
            "Module audio : enregistrement, transcription, mesure du débit, de la clarté et des hésitations, plan d'entraînement.",
            "Module langues : entraînement à la prononciation avec correction phonétique et progression par niveaux.",
            "Module vidéo : analyse de la posture, du regard et de la gestuelle face caméra.",
            "Analyse de CV : évaluation par intelligence artificielle avec score et axes d'amélioration.",
            "Coach virtuel : synthèse hebdomadaire et recommandations d'exercices.",
          ],
        },
        {
          type: "p",
          text: "L'éditeur peut faire évoluer, suspendre ou supprimer tout ou partie des fonctionnalités, notamment pour des raisons techniques, de sécurité ou d'évolution du service.",
        },
      ],
    },
    {
      id: "obligations",
      heading: "4. Obligations de l'utilisateur",
      blocks: [
        {
          type: "ul",
          items: [
            "Utiliser le service de manière loyale, personnelle et conforme à la loi.",
            "Ne pas téléverser de contenu illicite, diffamatoire, haineux, ou portant atteinte aux droits de tiers.",
            "Ne pas enregistrer la voix ou l'image d'un tiers sans son consentement.",
            "Ne pas tenter de contourner, extraire, décompiler ou surcharger le service, ni d'automatiser son usage (scraping, robots).",
            "Ne pas revendre ni partager son accès.",
          ],
        },
        {
          type: "p",
          text: "Tout manquement peut entraîner la suspension ou la suppression du compte, sans préjudice d'éventuelles poursuites.",
        },
      ],
    },
    {
      id: "pi",
      heading: "5. Propriété intellectuelle",
      blocks: [
        {
          type: "p",
          text: `L'application, sa marque, son design, ses contenus pédagogiques, exercices et algorithmes sont la propriété exclusive de ${EDITOR.name} et protégés par le droit de la propriété intellectuelle. Toute reproduction ou réutilisation non autorisée est interdite.`,
        },
        {
          type: "p",
          text: "Les contenus que vous importez ou créez (enregistrements audio et vidéo, CV, textes) restent votre propriété. Vous accordez à l'éditeur une licence strictement limitée, non exclusive et temporaire, aux seules fins de fournir l'analyse demandée et d'afficher vos résultats.",
        },
      ],
    },
    {
      id: "abonnement",
      heading: "6. Abonnement, essai et résiliation",
      blocks: [
        {
          type: "ul",
          items: [
            "Le service comporte une offre gratuite et [des offres payantes — à préciser : tarifs TTC, périodicité].",
            "Un essai gratuit de [DURÉE] peut être proposé ; à son terme, l'abonnement se poursuit au tarif en vigueur sauf résiliation avant l'échéance.",
            "Les abonnements sont renouvelés automatiquement à chaque période, sauf résiliation depuis les paramètres du compte ou la boutique applicative concernée.",
            "Droit de rétractation : conformément à l'article L221-28 du Code de la consommation, en demandant l'accès immédiat au contenu numérique, vous renoncez à votre droit de rétractation de 14 jours. [À adapter selon votre modèle commercial.]",
            "La résiliation prend effet à la fin de la période en cours ; aucun remboursement au prorata n'est dû sauf disposition légale contraire.",
          ],
        },
      ],
    },
    {
      id: "responsabilite",
      heading: "7. Limitation de responsabilité",
      blocks: [
        {
          type: "p",
          text: "ALESIM est un outil d'aide à l'entraînement. Il ne constitue ni un acte de soin, ni une thérapie du langage, ni un conseil en recrutement. Les analyses automatiques (voix, posture, CV) sont indicatives et peuvent comporter des erreurs.",
        },
        {
          type: "ul",
          items: [
            "Aucun résultat professionnel, aucune obtention d'emploi ni aucune amélioration mesurable ne sont garantis.",
            "En cas de trouble du langage avéré, consultez un orthophoniste ou un professionnel de santé.",
            "L'éditeur est tenu d'une obligation de moyens ; sa responsabilité ne saurait être engagée en cas d'interruption, de perte de données due à l'utilisateur, ou d'usage non conforme.",
            "La responsabilité de l'éditeur, si elle est retenue, est limitée aux sommes versées par l'utilisateur au cours des 12 derniers mois.",
          ],
        },
      ],
    },
    {
      id: "cloture",
      heading: "8. Clôture du compte",
      blocks: [
        {
          type: "p",
          text: `Vous pouvez supprimer votre compte à tout moment depuis les paramètres de l'application ou en écrivant à ${EDITOR.email}. La suppression entraîne l'effacement de vos contenus dans les délais indiqués dans la politique de confidentialité.`,
        },
      ],
    },
    {
      id: "droit",
      heading: "9. Droit applicable et juridiction",
      blocks: [
        {
          type: "p",
          text: "Les présentes CGU sont soumises au droit français. En cas de litige, une solution amiable sera recherchée en priorité ; le consommateur peut recourir gratuitement à un médiateur de la consommation ([NOM ET COORDONNÉES DU MÉDIATEUR]) ou à la plateforme européenne de règlement en ligne des litiges. À défaut, les tribunaux compétents sont ceux du ressort du siège de l'éditeur, sous réserve des règles protectrices du consommateur.",
        },
      ],
    },
    {
      id: "evolution",
      heading: "10. Modification des CGU",
      blocks: [
        {
          type: "p",
          text: "Les CGU peuvent être modifiées. Toute modification substantielle est notifiée par email ou dans l'application au moins 15 jours avant son entrée en vigueur. La poursuite de l'utilisation vaut acceptation ; à défaut, vous pouvez résilier votre compte.",
        },
      ],
    },
  ],
};

export const COOKIES: LegalDoc = {
  slug: "cookies",
  title: "Gestion des cookies",
  lead: "Quels traceurs ALESIM utilise, pourquoi, et comment garder la main dessus.",
  updatedAt: UPDATED,
  sections: [
    {
      id: "principe",
      heading: "1. Principe",
      blocks: [
        {
          type: "p",
          text: "Un cookie (ou traceur) est un fichier déposé sur votre terminal lors de la consultation de l'application. Conformément à l'article 82 de la loi Informatique et Libertés et aux recommandations de la CNIL, aucun traceur non essentiel n'est déposé avant votre consentement explicite.",
        },
      ],
    },
    {
      id: "categories",
      heading: "2. Catégories de traceurs utilisés",
      blocks: [
        {
          type: "table",
          head: ["Catégorie", "Finalité", "Exemples", "Durée"],
          rows: [
            [
              "Strictement nécessaires (toujours actifs)",
              "Authentification, sécurité, maintien de la session, mémorisation du choix de cookies",
              "Jeton de session, alesim_cookie_consent",
              "Session à 6 mois",
            ],
            [
              "Préférences",
              "Langue, thème d'affichage, réglages d'exercices et de rappels",
              "alesim_lang, préférences locales",
              "12 mois",
            ],
            [
              "Mesure d'audience / analytics",
              "Statistiques d'usage agrégées pour améliorer le service",
              "Firebase Analytics / Google Analytics (le cas échéant)",
              "13 mois maximum",
            ],
          ],
        },
        {
          type: "p",
          text: "Aucun traceur publicitaire ni de réseau social n'est utilisé. Le consentement est conservé 6 mois, puis vous est redemandé.",
        },
      ],
    },
    {
      id: "controle",
      heading: "3. Contrôler vos préférences",
      blocks: [
        {
          type: "p",
          text: "Lors de votre première visite, un bandeau vous permet d'accepter tout, de refuser tout ou de personnaliser catégorie par catégorie. Vous pouvez revenir sur votre choix à tout moment via le bouton « Gérer les cookies » présent en bas de chaque page et dans votre profil.",
        },
        {
          type: "p",
          text: "Refuser les traceurs non essentiels n'empêche pas l'utilisation d'ALESIM. Vous pouvez également configurer votre navigateur pour bloquer les cookies, au risque de dégrader certaines fonctionnalités.",
        },
      ],
    },
  ],
};

export const NOTICE: LegalDoc = {
  slug: "mentions-legales",
  title: "Mentions légales",
  lead: "Informations relatives à l'éditeur et à l'hébergeur d'ALESIM.",
  updatedAt: UPDATED,
  sections: [
    {
      id: "editeur",
      heading: "1. Éditeur",
      blocks: [
        {
          type: "ul",
          items: [
            `Dénomination : ${EDITOR.name}`,
            `Forme juridique : ${EDITOR.legalForm}`,
            `Siège social : ${EDITOR.address}`,
            `Immatriculation : ${EDITOR.siret}`,
            `TVA intracommunautaire : ${EDITOR.vat}`,
            `Email : ${EDITOR.email} — Téléphone : ${EDITOR.phone}`,
          ],
        },
      ],
    },
    {
      id: "publication",
      heading: "2. Directeur de la publication",
      blocks: [{ type: "p", text: `${EDITOR.publisher} — ${EDITOR.email}` }],
    },
    {
      id: "hebergeur",
      heading: "3. Hébergement",
      blocks: [
        {
          type: "ul",
          items: [
            "Hébergement de l'application : [NOM DE L'HÉBERGEUR — ex. Cloudflare, Inc., 101 Townsend St, San Francisco, CA 94107, États-Unis].",
            "Hébergement des données et de la base : [NOM DE L'HÉBERGEUR DE BASE DE DONNÉES + ADRESSE + RÉGION].",
            "Services d'authentification et de notification : Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irlande.",
          ],
        },
      ],
    },
    {
      id: "pi",
      heading: "4. Propriété intellectuelle",
      blocks: [
        {
          type: "p",
          text: `L'ensemble des éléments de l'application ALESIM (marque, logo, textes, illustrations, interfaces, contenus pédagogiques, code) est protégé et demeure la propriété exclusive de ${EDITOR.name}. Toute reproduction, représentation ou adaptation, totale ou partielle, sans autorisation écrite préalable est interdite.`,
        },
      ],
    },
    {
      id: "contact",
      heading: "5. Contact et signalement",
      blocks: [
        {
          type: "p",
          text: `Pour toute question, réclamation ou signalement de contenu : ${EDITOR.email}. Pour les demandes relatives aux données personnelles : ${EDITOR.privacyEmail}.`,
        },
      ],
    },
  ],
};

export const GDPR: LegalDoc = {
  slug: "rgpd",
  title: "RGPD : finalités, durées et droits",
  lead: "Pourquoi ALESIM traite vos données, combien de temps elles sont conservées, et comment exercer vos droits — y compris le retrait du consentement audio.",
  updatedAt: UPDATED,
  sections: [
    {
      id: "responsable",
      heading: "1. Responsable de traitement",
      blocks: [
        {
          type: "p",
          text: `Les traitements décrits sur cette page sont mis en œuvre par ${EDITOR.name}, ${EDITOR.address}. Contact dédié aux données personnelles : ${EDITOR.privacyEmail}. Délégué à la protection des données : ${EDITOR.dpo}.`,
        },
        {
          type: "p",
          text: "Cette page résume, en langage clair, ce que détaille la politique de confidentialité. En cas de divergence, la politique de confidentialité fait foi.",
        },
      ],
    },
    {
      id: "finalites",
      heading: "2. Finalités et bases légales",
      blocks: [
        {
          type: "table",
          head: ["Finalité", "Données concernées", "Base légale (art. 6 RGPD)"],
          rows: [
            [
              "Créer et gérer votre compte, vous authentifier",
              "Email, identifiant, prénom / nom affiché, méthode de connexion",
              "Exécution du contrat (CGU)",
            ],
            [
              "Capturer votre voix et la transcrire (reconnaissance vocale)",
              "Enregistrement audio temporaire, transcription texte",
              "Consentement explicite, retirable à tout moment",
            ],
            [
              "Analyser votre élocution (débit, clarté, hésitations) et générer un feedback IA",
              "Transcription, indicateurs calculés, scores",
              "Consentement explicite",
            ],
            [
              "Analyse vidéo optionnelle (posture, regard) — traitement dans votre navigateur",
              "Flux caméra non transmis, indicateurs agrégés",
              "Consentement explicite",
            ],
            [
              "Analyse de CV (module optionnel)",
              "Texte extrait du document que vous importez",
              "Consentement explicite",
            ],
            [
              "Suivre votre progression : leçons, quiz, badges, séries (streaks)",
              "Résultats d'exercices, dates d'activité, préférences de thèmes",
              "Exécution du contrat",
            ],
            [
              "Envoyer des rappels et notifications push",
              "Abonnement push du navigateur, horaires choisis",
              "Consentement",
            ],
            [
              "Mesurer l'usage du parcours (statistiques agrégées)",
              "Événements de navigation pseudonymisés, type d'appareil",
              "Consentement (traceurs de mesure d'audience)",
            ],
            [
              "Sécurité, prévention des abus, journaux techniques",
              "Horodatages, événements techniques",
              "Intérêt légitime",
            ],
          ],
        },
        {
          type: "p",
          text: "Aucune décision entièrement automatisée produisant des effets juridiques n'est prise à votre égard : les feedbacks IA sont des aides pédagogiques.",
        },
      ],
    },
    {
      id: "durees",
      heading: "3. Durées de conservation",
      blocks: [
        {
          type: "table",
          head: ["Donnée", "Durée de conservation"],
          rows: [
            [
              "Enregistrement audio brut",
              "Traité à la volée puis supprimé ; jamais conservé sur nos serveurs après l'analyse",
            ],
            [
              "Transcriptions et résultats d'analyse stockés sur votre appareil",
              "Jusqu'à effacement par vos soins (bouton d'effacement dans l'historique / le profil)",
            ],
            [
              "Compte et données de progression",
              "Toute la durée du compte, puis suppression sous 30 jours après sa fermeture",
            ],
            [
              "Journal local du consentement audio",
              "12 mois glissants, ou effacement immédiat à votre demande",
            ],
            ["Consentement audio", "12 mois, puis nouvelle demande explicite"],
            ["Choix de cookies", "6 mois"],
            ["Statistiques d'usage pseudonymisées", "13 mois maximum"],
            ["Journaux techniques et de sécurité", "12 mois maximum"],
          ],
        },
      ],
    },
    {
      id: "destinataires",
      heading: "4. Destinataires et transferts",
      blocks: [
        {
          type: "ul",
          items: [
            "Hébergeur de l'application et de la base de données (voir les mentions légales).",
            "Fournisseurs de modèles d'IA utilisés pour la transcription et le feedback, agissant en sous-traitants et sans réutilisation de vos contenus pour entraîner leurs modèles.",
            "Service d'authentification et de notifications (Google Ireland Limited) si vous l'utilisez.",
          ],
        },
        {
          type: "p",
          text: "Aucune donnée n'est vendue ni cédée à des fins publicitaires. Lorsqu'un transfert hors Union européenne est nécessaire, il est encadré par les clauses contractuelles types de la Commission européenne.",
        },
      ],
    },
    {
      id: "droits",
      heading: "5. Vos droits",
      blocks: [
        {
          type: "ul",
          items: [
            "Accès (art. 15) : obtenir une copie des données vous concernant.",
            "Rectification (art. 16) : corriger une donnée inexacte depuis votre profil ou sur demande.",
            "Effacement (art. 17) : supprimer votre compte et les données associées.",
            "Limitation (art. 18) : geler un traitement le temps d'une vérification.",
            "Portabilité (art. 20) : exporter votre historique et vos résultats en PDF, CSV ou JSON depuis l'application.",
            "Opposition (art. 21) : vous opposer aux traitements fondés sur l'intérêt légitime.",
            "Retrait du consentement (art. 7.3) : retirer, à tout moment et aussi simplement que vous l'avez donné, votre accord pour la capture audio, la vidéo ou les notifications.",
            "Directives post mortem (art. 85 loi Informatique et Libertés) : définir le sort de vos données après votre décès.",
          ],
        },
        {
          type: "p",
          text: `Pour exercer ces droits : ${EDITOR.privacyEmail}. Nous répondons dans un délai d'un mois (prolongeable de deux mois en cas de demande complexe). Une preuve d'identité peut être demandée en cas de doute raisonnable.`,
        },
        {
          type: "p",
          text: "Si la réponse ne vous satisfait pas, vous pouvez introduire une réclamation auprès de la CNIL : 3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07 — www.cnil.fr.",
        },
      ],
    },
    {
      id: "securite",
      heading: "6. Sécurité et minimisation",
      blocks: [
        {
          type: "ul",
          items: [
            "Chiffrement des échanges (HTTPS) et des données au repos chez l'hébergeur.",
            "Cloisonnement par utilisateur : chacun n'accède qu'à ses propres données.",
            "Traitements exécutés localement lorsque c'est possible (analyse vidéo, journal de consentement, historique).",
            "Collecte limitée au strict nécessaire : ni empreinte de navigateur, ni user-agent conservé pour la mesure d'audience.",
          ],
        },
      ],
    },
  ],
};

export const LEGAL_DOCS = {
  confidentialite: PRIVACY,
  cgu: TERMS,
  cookies: COOKIES,
  "mentions-legales": NOTICE,
  rgpd: GDPR,
} as const;

export const LEGAL_LINKS = [
  { to: "/legal/confidentialite", label: "Politique de confidentialité" },
  { to: "/legal/rgpd", label: "RGPD" },
  { to: "/legal/cgu", label: "CGU" },
  { to: "/legal/cookies", label: "Cookies" },
  { to: "/legal/mentions-legales", label: "Mentions légales" },
] as const;

export function formatUpdatedAt(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
