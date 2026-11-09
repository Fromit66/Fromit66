import { WorkoutHistoryItem, Exercise } from '../types';

export interface SpreadsheetRef {
  id: string;
  name: string;
  url: string;
}

const DEFAULT_SPREADSHEET_NAME = 'FitTrainer - Registro de Entrenamientos';

/**
 * Searches for an existing FitTrainer spreadsheet in Google Drive,
 * or creates a pristine formatted one if it doesn't exist yet.
 */
export async function findOrCreateWorkoutSpreadsheet(accessToken: string): Promise<SpreadsheetRef> {
  // 1. Search Google Drive for existing sheet
  try {
    const driveQuery = encodeURIComponent(
      `name = '${DEFAULT_SPREADSHEET_NAME}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`
    );
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${driveQuery}&fields=files(id,name,webViewLink)`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (searchRes.ok) {
      const data = await searchRes.json();
      if (data.files && data.files.length > 0) {
        const file = data.files[0];
        return {
          id: file.id,
          name: file.name,
          url: file.webViewLink || `https://docs.google.com/spreadsheets/d/${file.id}`,
        };
      }
    }
  } catch (err) {
    console.warn('Error searching existing Drive sheet, will create a new one:', err);
  }

  // 2. Create new spreadsheet with styled tabs
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title: DEFAULT_SPREADSHEET_NAME,
      },
      sheets: [
        {
          properties: {
            title: 'Sesiones',
            gridProperties: { rowCount: 1000, columnCount: 10, frozenRowCount: 1 },
          },
        },
        {
          properties: {
            title: 'Detalle_Ejercicios',
            gridProperties: { rowCount: 2000, columnCount: 8, frozenRowCount: 1 },
          },
        },
        {
          properties: {
            title: 'Catalogo_Ejercicios',
            gridProperties: { rowCount: 100, columnCount: 8, frozenRowCount: 1 },
          },
        },
      ],
    }),
  });

  if (!createRes.ok) {
    const errorBody = await createRes.text();
    throw new Error(`Error creando la hoja de cálculo: ${errorBody}`);
  }

  const newSheet = await createRes.json();
  const spreadsheetId = newSheet.spreadsheetId;
  const spreadsheetUrl =
    newSheet.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

  // 3. Write header rows to all tabs
  const headerValues = [
    {
      range: 'Sesiones!A1:I1',
      values: [
        [
          'ID Sesión',
          'Fecha',
          'Hora',
          'Nombre Rutina',
          'Duración (seg)',
          'Duración (min)',
          'Ejercicios Completados',
          'Total Ejercicios',
          'Completado (%)',
        ],
      ],
    },
    {
      range: 'Detalle_Ejercicios!A1:F1',
      values: [
        [
          'ID Sesión',
          'Fecha',
          'Ejercicio',
          'Modo (Reps / Tiempo)',
          'Objetivo',
          'Estado',
        ],
      ],
    },
    {
      range: 'Catalogo_Ejercicios!A1:G1',
      values: [
        [
          'ID',
          'Nombre',
          'Grupo Muscular',
          'Modo',
          'Reps Predeterminadas',
          'Segundos Predeterminados',
          'Técnica / Descripción',
        ],
      ],
    },
  ];

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: headerValues,
      }),
    }
  );

  return {
    id: spreadsheetId,
    name: DEFAULT_SPREADSHEET_NAME,
    url: spreadsheetUrl,
  };
}

/**
 * Appends a finished workout session to Google Sheets
 */
export async function appendWorkoutToSheet(
  accessToken: string,
  spreadsheetId: string,
  session: WorkoutHistoryItem
): Promise<boolean> {
  const d = new Date(session.date);
  const dateStr = d.toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const timeStr = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const minutes = Math.round((session.durationSeconds / 60) * 10) / 10;
  const percent = Math.round((session.completedCount / (session.totalCount || 1)) * 100);

  // 1. Session summary row
  const sessionRow = [
    session.id,
    dateStr,
    timeStr,
    session.routineName || 'Entrenamiento Personalizado',
    session.durationSeconds,
    minutes,
    session.completedCount,
    session.totalCount,
    `${percent}%`,
  ];

  const appendSessionRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sesiones!A1:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [sessionRow],
      }),
    }
  );

  if (!appendSessionRes.ok) {
    const err = await appendSessionRes.text();
    console.error('Failed to append session to Google Sheets:', err);
    return false;
  }

  // 2. Breakdown exercises rows
  if (session.items && session.items.length > 0) {
    const detailRows = session.items.map((item) => [
      session.id,
      dateStr,
      item.name,
      item.mode === 'reps' ? 'Repeticiones' : 'Tiempo',
      item.mode === 'reps' ? `${item.target} reps` : `${item.target} seg`,
      item.completed ? 'Completado' : 'Omitido',
    ]);

    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Detalle_Ejercicios!A1:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: detailRows,
        }),
      }
    );
  }

  return true;
}

/**
 * Synchronizes all historical workouts to Google Sheets
 */
export async function syncAllHistoryToSheet(
  accessToken: string,
  spreadsheetId: string,
  history: WorkoutHistoryItem[]
): Promise<number> {
  if (history.length === 0) return 0;

  // Read existing session IDs from the sheet to prevent duplicates
  let existingIds = new Set<string>();
  try {
    const readRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sesiones!A2:A`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    if (readRes.ok) {
      const readData = await readRes.json();
      if (readData.values) {
        existingIds = new Set(readData.values.map((row: string[]) => row[0]));
      }
    }
  } catch (err) {
    console.warn('Could not read existing IDs, appending all:', err);
  }

  const newSessions = history.filter((item) => !existingIds.has(item.id));
  if (newSessions.length === 0) return 0;

  for (const session of newSessions) {
    await appendWorkoutToSheet(accessToken, spreadsheetId, session);
  }

  return newSessions.length;
}

/**
 * Exports current catalog of exercises to Google Sheets
 */
export async function exportCatalogToSheet(
  accessToken: string,
  spreadsheetId: string,
  catalog: Exercise[]
): Promise<boolean> {
  const rows = catalog.map((ex) => [
    ex.id,
    ex.name,
    ex.category,
    ex.mode === 'both' ? 'Reps o Tiempo' : ex.mode === 'reps' ? 'Repeticiones' : 'Tiempo',
    ex.defaultReps || 12,
    ex.defaultTime || 30,
    ex.description || '',
  ]);

  // Overwrite starting from A2
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Catalogo_Ejercicios!A2:G${rows.length + 2}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: rows,
      }),
    }
  );

  return res.ok;
}
