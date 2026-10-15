// -----------------------------------------------------------------------------
// Every text the integration produces, in the four languages of the Gladys
// interface. German says "du", Spanish "usted" (test/i18n.test.js checks it).
//
// Two kinds of tables:
//   - one table per language (NAMES, OPTION_LABELS...): texts fixed in Gladys
//     in the language of the config (`language`, French by default), since a
//     device integration does not receive the user's language;
//   - multi-language objects (MESSAGES): the core picks the user's language.
// -----------------------------------------------------------------------------

/** Feature names, fixed when the device is added to Gladys. */
export const NAMES = {
  en: {
    connector_status: 'Connector',
    charging_state: 'Charging state',
    plugged: 'Car plugged in',
    power: 'Charging power',
    power_l1: 'Power L1',
    power_l2: 'Power L2',
    power_l3: 'Power L3',
    current_l1: 'Current L1',
    current_l2: 'Current L2',
    current_l3: 'Current L3',
    session_energy: 'Session energy',
    total_energy: 'Total energy',
    target_current: 'Charging current',
    force_mode: 'Charging mode',
    phase_mode: 'Phases',
    temperature: 'Temperature',
    error: 'Error',
    online: 'Online',
  },
  fr: {
    connector_status: 'Connecteur',
    charging_state: 'État de la charge',
    plugged: 'Voiture branchée',
    power: 'Puissance de charge',
    power_l1: 'Puissance L1',
    power_l2: 'Puissance L2',
    power_l3: 'Puissance L3',
    current_l1: 'Courant L1',
    current_l2: 'Courant L2',
    current_l3: 'Courant L3',
    session_energy: 'Énergie de la session',
    total_energy: 'Énergie totale',
    target_current: 'Courant de charge',
    force_mode: 'Mode de charge',
    phase_mode: 'Phases',
    temperature: 'Température',
    error: 'Erreur',
    online: 'En ligne',
  },
  de: {
    connector_status: 'Anschluss',
    charging_state: 'Ladezustand',
    plugged: 'Auto angesteckt',
    power: 'Ladeleistung',
    power_l1: 'Leistung L1',
    power_l2: 'Leistung L2',
    power_l3: 'Leistung L3',
    current_l1: 'Stromstärke L1',
    current_l2: 'Stromstärke L2',
    current_l3: 'Stromstärke L3',
    session_energy: 'Energie der Sitzung',
    total_energy: 'Gesamtenergie',
    target_current: 'Ladestrom',
    force_mode: 'Lademodus',
    phase_mode: 'Phasen',
    temperature: 'Temperatur',
    error: 'Fehler',
    online: 'Online',
  },
  es: {
    connector_status: 'Conector',
    charging_state: 'Estado de la carga',
    plugged: 'Coche enchufado',
    power: 'Potencia de carga',
    power_l1: 'Potencia L1',
    power_l2: 'Potencia L2',
    power_l3: 'Potencia L3',
    current_l1: 'Corriente L1',
    current_l2: 'Corriente L2',
    current_l3: 'Corriente L3',
    session_energy: 'Energía de la sesión',
    total_energy: 'Energía total',
    target_current: 'Corriente de carga',
    force_mode: 'Modo de carga',
    phase_mode: 'Fases',
    temperature: 'Temperatura',
    error: 'Error',
    online: 'En línea',
  },
};

/** Labels of the select options (charging mode, phases). */
export const OPTION_LABELS = {
  en: {
    neutral: 'Automatic (app)',
    off: 'Forced stop',
    on: 'Forced charge',
    auto: 'Automatic',
    one: 'One phase',
    three: 'Three phases',
  },
  fr: {
    neutral: 'Automatique (appli)',
    off: 'Arrêt forcé',
    on: 'Charge forcée',
    auto: 'Automatique',
    one: 'Monophasé',
    three: 'Triphasé',
  },
  de: {
    neutral: 'Automatisch (App)',
    off: 'Erzwungener Stopp',
    on: 'Erzwungenes Laden',
    auto: 'Automatisch',
    one: 'Einphasig',
    three: 'Dreiphasig',
  },
  es: {
    neutral: 'Automático (app)',
    off: 'Parada forzada',
    on: 'Carga forzada',
    auto: 'Automático',
    one: 'Monofásico',
    three: 'Trifásico',
  },
};

/** The go-e car state, as the widget says it (key = `car` value). */
export const CAR_LABELS = {
  en: {
    0: 'Unknown',
    1: 'Ready',
    2: 'Charging',
    3: 'Waiting for the car',
    4: 'Charge complete',
    5: 'Error',
    offline: 'Offline',
  },
  fr: {
    0: 'Inconnu',
    1: 'Prête',
    2: 'En charge',
    3: 'En attente de la voiture',
    4: 'Charge terminée',
    5: 'Erreur',
    offline: 'Hors ligne',
  },
  de: {
    0: 'Unbekannt',
    1: 'Bereit',
    2: 'Lädt',
    3: 'Wartet auf das Auto',
    4: 'Laden beendet',
    5: 'Fehler',
    offline: 'Offline',
  },
  es: {
    0: 'Desconocido',
    1: 'Lista',
    2: 'Cargando',
    3: 'Esperando el coche',
    4: 'Carga terminada',
    5: 'Error',
    offline: 'Sin conexión',
  },
};

/** go-e `err` codes (API v2 documentation), as the Error feature says them. */
export const ERROR_LABELS = {
  en: {
    0: 'None',
    1: 'Residual current (AC)',
    2: 'Residual current (DC)',
    3: 'Phase fault',
    4: 'Overvoltage',
    5: 'Overcurrent',
    6: 'Diode fault',
    7: 'Invalid cable (PP)',
    8: 'Earth fault',
    9: 'Contactor stuck',
    10: 'Contactor missing',
    11: 'Residual current device fault',
    12: 'Unknown error',
    13: 'Overheating',
    14: 'No communication',
    15: 'Cable lock stuck open',
    16: 'Cable lock stuck locked',
    other: 'Error',
  },
  fr: {
    0: 'Aucune',
    1: 'Courant de fuite (AC)',
    2: 'Courant de fuite (DC)',
    3: 'Défaut de phase',
    4: 'Surtension',
    5: 'Surintensité',
    6: 'Défaut de diode',
    7: 'Câble non valide (PP)',
    8: 'Défaut de terre',
    9: 'Contacteur bloqué',
    10: 'Contacteur absent',
    11: 'Défaut du différentiel',
    12: 'Erreur inconnue',
    13: 'Surchauffe',
    14: 'Pas de communication',
    15: 'Verrou du câble bloqué ouvert',
    16: 'Verrou du câble bloqué fermé',
    other: 'Erreur',
  },
  de: {
    0: 'Keiner',
    1: 'Fehlerstrom (AC)',
    2: 'Fehlerstrom (DC)',
    3: 'Phasenfehler',
    4: 'Überspannung',
    5: 'Überstrom',
    6: 'Diodenfehler',
    7: 'Ungültiges Kabel (PP)',
    8: 'Erdungsfehler',
    9: 'Schütz klemmt',
    10: 'Schütz fehlt',
    11: 'Fehler des FI-Schutzes',
    12: 'Unbekannter Fehler',
    13: 'Überhitzung',
    14: 'Keine Kommunikation',
    15: 'Kabelverriegelung klemmt offen',
    16: 'Kabelverriegelung klemmt zu',
    other: 'Fehler',
  },
  es: {
    0: 'Ninguno',
    1: 'Corriente de fuga (AC)',
    2: 'Corriente de fuga (DC)',
    3: 'Fallo de fase',
    4: 'Sobretensión',
    5: 'Sobreintensidad',
    6: 'Fallo de diodo',
    7: 'Cable no válido (PP)',
    8: 'Fallo de tierra',
    9: 'Contactor bloqueado',
    10: 'Contactor ausente',
    11: 'Fallo del diferencial',
    12: 'Error desconocido',
    13: 'Sobrecalentamiento',
    14: 'Sin comunicación',
    15: 'Bloqueo del cable atascado abierto',
    16: 'Bloqueo del cable atascado cerrado',
    other: 'Error',
  },
};

/** The text of the Error feature: never empty (Gladys ignores an empty text). */
export function errorLabel(language, code) {
  const table = ERROR_LABELS[language] ?? ERROR_LABELS.en;
  return table[code] ?? `${table.other} ${code}`;
}

/** The widget texts, one table per language. */
export const WIDGET_TEXT = {
  en: {
    state: 'State',
    mode: 'Mode',
    phases: 'Phases',
    error: 'Error',
    power: 'Power',
    session: 'Session',
    current: 'Current',
    charge: 'Charge',
    stop: 'Stop',
    auto: 'Auto',
    setCurrent: 'Current…',
    currentField: 'Charging current (A)',
    pick: 'Pick a charger in the widget settings.',
    unknownCharger: 'This charger is not configured any more.',
  },
  fr: {
    state: 'État',
    mode: 'Mode',
    phases: 'Phases',
    error: 'Erreur',
    power: 'Puissance',
    session: 'Session',
    current: 'Courant',
    charge: 'Charger',
    stop: 'Arrêter',
    auto: 'Auto',
    setCurrent: 'Courant…',
    currentField: 'Courant de charge (A)',
    pick: 'Choisissez une borne dans les réglages du widget.',
    unknownCharger: "Cette borne n'est plus configurée.",
  },
  de: {
    state: 'Zustand',
    mode: 'Modus',
    phases: 'Phasen',
    error: 'Fehler',
    power: 'Leistung',
    session: 'Sitzung',
    current: 'Strom',
    charge: 'Laden',
    stop: 'Stoppen',
    auto: 'Auto',
    setCurrent: 'Strom…',
    currentField: 'Ladestrom (A)',
    pick: 'Wähle eine Ladestation in den Widget-Einstellungen.',
    unknownCharger: 'Diese Ladestation ist nicht mehr konfiguriert.',
  },
  es: {
    state: 'Estado',
    mode: 'Modo',
    phases: 'Fases',
    error: 'Error',
    power: 'Potencia',
    session: 'Sesión',
    current: 'Corriente',
    charge: 'Cargar',
    stop: 'Detener',
    auto: 'Auto',
    setCurrent: 'Corriente…',
    currentField: 'Corriente de carga (A)',
    pick: 'Elija un cargador en los ajustes del widget.',
    unknownCharger: 'Este cargador ya no está configurado.',
  },
};

/** Messages shown by the core in the user's language (multi-language objects). */
export const MESSAGES = {
  notConfigured: {
    en: 'Enter the IP address of your go-e Charger, or its cloud access.',
    fr: "Saisissez l'adresse IP de votre borne go-e, ou son accès cloud.",
    de: 'Gib die IP-Adresse deiner go-e Ladestation oder ihren Cloud-Zugang ein.',
    es: 'Introduzca la dirección IP de su cargador go-e, o su acceso a la nube.',
  },
  initFailed: {
    en: 'Initialization failed, check the integration logs.',
    fr: "L'initialisation a échoué, consultez les logs de l'intégration.",
    de: 'Initialisierung fehlgeschlagen, sieh dir die Protokolle der Integration an.',
    es: 'La inicialización ha fallado, consulte los registros de la integración.',
  },
  cloudIncomplete: {
    en: 'Cloud access needs both the serial number and the API token.',
    fr: "L'accès cloud demande le numéro de série et le jeton d'API.",
    de: 'Der Cloud-Zugang braucht die Seriennummer und das API-Token.',
    es: 'El acceso a la nube necesita el número de serie y el token de API.',
  },
  invalidHosts: (list) => ({
    en: `Ignored addresses: ${list}.`,
    fr: `Adresses ignorées : ${list}.`,
    de: `Ignorierte Adressen: ${list}.`,
    es: `Direcciones ignoradas: ${list}.`,
  }),
  // Why a charger does not answer, by GoeError kind.
  failure: {
    unreachable: (where) => ({
      en: `${where}: no answer. Check the address and that the charger is on the network.`,
      fr: `${where} : pas de réponse. Vérifiez l'adresse et que la borne est sur le réseau.`,
      de: `${where}: keine Antwort. Prüfe die Adresse und ob die Ladestation im Netzwerk ist.`,
      es: `${where}: sin respuesta. Compruebe la dirección y que el cargador esté en la red.`,
    }),
    api_disabled: (where) => ({
      en: `${where}: the local HTTP API v2 is off. Turn it on in the go-e app (Internet → Advanced settings).`,
      fr: `${where} : l'API HTTP v2 locale est désactivée. Activez-la dans l'appli go-e (Internet → Paramètres avancés).`,
      de: `${where}: die lokale HTTP-API v2 ist aus. Schalte sie in der go-e App ein (Internet → Erweiterte Einstellungen).`,
      es: `${where}: la API HTTP v2 local está desactivada. Actívela en la app go-e (Internet → Ajustes avanzados).`,
    }),
    cloud_denied: (where) => ({
      en: `${where}: the go-e cloud refused the token, or the cloud API is off in the app.`,
      fr: `${where} : le cloud go-e refuse le jeton, ou l'API cloud est désactivée dans l'appli.`,
      de: `${where}: die go-e Cloud lehnt das Token ab, oder die Cloud-API ist in der App aus.`,
      es: `${where}: la nube go-e rechaza el token, o la API en la nube está desactivada en la app.`,
    }),
    cloud_offline: (where) => ({
      en: `${where}: the charger sends no data to the go-e cloud right now.`,
      fr: `${where} : la borne n'envoie pas de données au cloud go-e en ce moment.`,
      de: `${where}: die Ladestation sendet gerade keine Daten an die go-e Cloud.`,
      es: `${where}: el cargador no envía datos a la nube go-e en este momento.`,
    }),
    rejected: (where) => ({
      en: `${where}: the charger refused the request.`,
      fr: `${where} : la borne a refusé la demande.`,
      de: `${where}: die Ladestation hat die Anfrage abgelehnt.`,
      es: `${where}: el cargador ha rechazado la solicitud.`,
    }),
    http: (where) => ({
      en: `${where}: unexpected answer from the charger.`,
      fr: `${where} : réponse inattendue de la borne.`,
      de: `${where}: unerwartete Antwort der Ladestation.`,
      es: `${where}: respuesta inesperada del cargador.`,
    }),
  },
  // The "Test the connection" action, one line per charger.
  testOk: (name, serial, firmware) => ({
    en: `${name} (serial ${serial}, firmware ${firmware}): connected.`,
    fr: `${name} (n° ${serial}, micrologiciel ${firmware}) : connectée.`,
    de: `${name} (Nr. ${serial}, Firmware ${firmware}): verbunden.`,
    es: `${name} (n.º ${serial}, firmware ${firmware}): conectado.`,
  }),
  // Commands: shown as the toast of the widget and the result of scene actions.
  currentOutOfRange: (min, max) => ({
    en: `The charging current must be between ${min} and ${max} A.`,
    fr: `Le courant de charge doit être compris entre ${min} et ${max} A.`,
    de: `Der Ladestrom muss zwischen ${min} und ${max} A liegen.`,
    es: `La corriente de carga debe estar entre ${min} y ${max} A.`,
  }),
  currentSet: (amps) => ({
    en: `Charging current set to ${amps} A.`,
    fr: `Courant de charge réglé sur ${amps} A.`,
    de: `Ladestrom auf ${amps} A gestellt.`,
    es: `Corriente de carga ajustada a ${amps} A.`,
  }),
  modeSet: {
    neutral: {
      en: 'Back to the automatic mode of the app.',
      fr: "Retour au mode automatique de l'appli.",
      de: 'Zurück zum automatischen Modus der App.',
      es: 'Vuelta al modo automático de la app.',
    },
    off: {
      en: 'Charging stopped.',
      fr: 'Charge arrêtée.',
      de: 'Laden gestoppt.',
      es: 'Carga detenida.',
    },
    on: {
      en: 'Charging forced on.',
      fr: 'Charge forcée.',
      de: 'Laden erzwungen.',
      es: 'Carga forzada.',
    },
  },
  noPhaseSwitch: {
    en: 'This charger cannot switch between one and three phases.',
    fr: 'Cette borne ne sait pas passer de monophasé à triphasé.',
    de: 'Diese Ladestation kann nicht zwischen ein- und dreiphasig wechseln.',
    es: 'Este cargador no puede cambiar entre monofásico y trifásico.',
  },
};

/** One line of a multi-language object list joined per language. */
export function joinMessages(messages, separator = '\n') {
  const result = {};
  for (const lang of ['en', 'fr', 'de', 'es']) {
    result[lang] = messages.map((message) => message[lang]).join(separator);
  }
  return result;
}
