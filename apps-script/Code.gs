const JSON_FIELDS = {
  motorcycles: ['highlights', 'customSpecs', 'hiddenFields'],
  warrantyPolicies: ['details'],
  quizQuestions: ['options', 'targetModelIds']
};

const BOOLEAN_FIELDS = [
  'isActive',
  'isCore',
  'isVisible'
];

const NUMBER_FIELDS = [
  'displacementCc',
  'tankLiters',
  'topSpeedKmh',
  'order',
  'correctIndex',
  'quizPoints',
  'gameHighScore',
  'totalPoints',
  'quizzesCompleted',
  'correctAnswers',
  'streakBest',
  'score',
  'correctCount',
  'totalQuestions'
];

function doGet(e) {
  try {
    const action = (e.parameter && e.parameter.action) || 'getAll';
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === 'getAll') {
      const data = {
        motorcycles: readSheetAsObjects(ss, 'motorcycles'),
        policies: readSheetAsObjects(ss, 'warrantyPolicies'),
        timeGuides: readSheetAsObjects(ss, 'timeGuides'),
        specFields: readSheetAsObjects(ss, 'specFields'),
        quizQuestions: readSheetAsObjects(ss, 'quizQuestions'),
        advisors: readSheetAsObjects(ss, 'advisors').sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0))
      };
      return jsonResponse({ ok: true, data });
    }

    return jsonResponse({ ok: false, error: 'Acción GET no válida' });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(15000);

  try {
    const payload = JSON.parse(e.postData.contents);
    const { action, sheetName, item, id, uid, data } = payload;
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === 'upsert') {
      const idKey = sheetName === 'advisors' ? 'uid' : 'id';
      const result = upsertRow(ss, sheetName, item, idKey);
      return jsonResponse({ ok: true, data: result });
    }

    if (action === 'delete') {
      const idKey = sheetName === 'advisors' ? 'uid' : 'id';
      deleteRow(ss, sheetName, id || uid, idKey);
      return jsonResponse({ ok: true });
    }

    if (action === 'toggleField') {
      const sheet = ss.getSheetByName(sheetName);
      const rows = sheet.getDataRange().getValues();
      const headers = rows[0];
      const idCol = headers.indexOf('id');
      const fieldCol = headers.indexOf(payload.field);

      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][idCol]) === String(id)) {
          const currentVal = rows[i][fieldCol] === true || String(rows[i][fieldCol]).toUpperCase() === 'TRUE';
          sheet.getRange(i + 1, fieldCol + 1).setValue(!currentVal);
          break;
        }
      }
      return jsonResponse({ ok: true });
    }

    if (action === 'completeQuiz') {
      const { advisorUid, advisorName, topic, score, correctCount, totalQuestions, maxStreak } = data;
      const advisors = readSheetAsObjects(ss, 'advisors');
      let advisor = advisors.find(a => a.uid === advisorUid);

      if (!advisor) {
        advisor = {
          uid: advisorUid,
          email: advisorUid,
          displayName: advisorName || 'Asesor Vento',
          branch: 'General',
          role: 'advisor',
          quizPoints: 0,
          gameHighScore: 0,
          totalPoints: 0,
          quizzesCompleted: 0,
          correctAnswers: 0,
          streakBest: 0
        };
      }

      advisor.quizPoints = (Number(advisor.quizPoints) || 0) + Number(score);
      advisor.totalPoints = advisor.quizPoints + (Number(advisor.gameHighScore) || 0);
      advisor.quizzesCompleted = (Number(advisor.quizzesCompleted) || 0) + 1;
      advisor.correctAnswers = (Number(advisor.correctAnswers) || 0) + Number(correctCount);
      advisor.streakBest = Math.max(Number(advisor.streakBest) || 0, Number(maxStreak));
      advisor.updatedAt = new Date().toISOString();

      upsertRow(ss, 'advisors', advisor, 'uid');

      upsertRow(ss, 'quizSessions', {
        id: `${advisorUid}_${Date.now()}`,
        advisorUid,
        advisorName: advisor.displayName,
        topic,
        score,
        correctCount,
        totalQuestions,
        createdAt: new Date().toISOString()
      }, 'id');

      return jsonResponse({ ok: true, advisor });
    }

    if (action === 'saveGameHighScore') {
      const { advisorUid, advisorName, newScore } = data;
      const advisors = readSheetAsObjects(ss, 'advisors');
      let advisor = advisors.find(a => a.uid === advisorUid);

      if (!advisor) {
        advisor = {
          uid: advisorUid,
          email: advisorUid,
          displayName: advisorName || 'Asesor Vento',
          branch: 'General',
          role: 'advisor',
          quizPoints: 0,
          gameHighScore: 0,
          totalPoints: 0,
          quizzesCompleted: 0,
          correctAnswers: 0,
          streakBest: 0
        };
      }

      if (Number(newScore) > (Number(advisor.gameHighScore) || 0)) {
        advisor.gameHighScore = Number(newScore);
        advisor.totalPoints = (Number(advisor.quizPoints) || 0) + advisor.gameHighScore;
        advisor.updatedAt = new Date().toISOString();
        upsertRow(ss, 'advisors', advisor, 'uid');
      }

      return jsonResponse({ ok: true, advisor });
    }

    if (action === 'batchSeed') {
      const collections = payload.collections;
      Object.keys(collections).forEach(sName => {
        const items = collections[sName];
        items.forEach(it => upsertRow(ss, sName, it, 'id'));
      });
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ ok: false, error: 'Acción POST no reconocida' });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  } finally {
    lock.releaseLock();
  }
}

function readSheetAsObjects(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0];
  const jsonCols = JSON_FIELDS[sheetName] || [];
  const result = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (!row[0] && row[0] !== 0) continue;

    const obj = {};
    headers.forEach((header, idx) => {
      let val = row[idx];

      if (jsonCols.includes(header)) {
        try {
          val = val ? JSON.parse(val) : (header === 'customSpecs' ? {} : []);
        } catch (e) {
          val = header === 'customSpecs' ? {} : [];
        }
      } else if (BOOLEAN_FIELDS.includes(header)) {
        val = val === true || String(val).toUpperCase() === 'TRUE';
      } else if (NUMBER_FIELDS.includes(header)) {
        val = val === '' || val === null ? 0 : Number(val);
      }

      obj[header] = val;
    });
    result.push(obj);
  }
  return result;
}

function upsertRow(ss, sheetName, item, idKey) {
  const sheet = ss.getSheetByName(sheetName);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const idCol = headers.indexOf(idKey);
  const jsonCols = JSON_FIELDS[sheetName] || [];

  const rowData = headers.map(h => {
    let val = item[h];
    if (val === undefined || val === null) return '';
    if (jsonCols.includes(h) && typeof val === 'object') {
      return JSON.stringify(val);
    }
    return val;
  });

  let rowIndex = -1;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idCol]) === String(item[idKey])) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, headers.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }
  return item;
}

function deleteRow(ss, sheetName, targetId, idKey) {
  const sheet = ss.getSheetByName(sheetName);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const idCol = headers.indexOf(idKey);

  for (let i = values.length - 1; i >= 1; i--) {
    if (String(values[i][idCol]) === String(targetId)) {
      sheet.deleteRow(i + 1);
    }
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
