import * as SQLite from 'expo-sqlite';

let banco: SQLite.SQLiteDatabase | null = null;

export async function inicializarBanco() {
  if (banco) {
    return banco;
  }

  banco = await SQLite.openDatabaseAsync('ello_bt.db');

  await banco.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario TEXT NOT NULL UNIQUE,
      senha TEXT NOT NULL,
      tipo TEXT NOT NULL DEFAULT 'aluno'
    );

    CREATE TABLE IF NOT EXISTS aulas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dia TEXT NOT NULL,
      horario TEXT NOT NULL,
      quadra TEXT NOT NULL DEFAULT '',
      vagas INTEGER NOT NULL,
      capacidade INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS reservas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      aula_id INTEGER NOT NULL,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
      FOREIGN KEY (aula_id) REFERENCES aulas(id),
      UNIQUE(usuario_id, aula_id)
    );
  `);

  // ==============================
  // VERIFICA COLUNA TIPO
  // ==============================

  const colunasUsuarios = await banco.getAllAsync<{
    name: string;
  }>('PRAGMA table_info(usuarios)');

  const possuiTipo = colunasUsuarios.some(
    (coluna) => coluna.name === 'tipo'
  );

  if (!possuiTipo) {
    await banco.execAsync(`
      ALTER TABLE usuarios
      ADD COLUMN tipo TEXT NOT NULL DEFAULT 'aluno'
    `);
  }

  // ==============================
  // VERIFICA COLUNA CAPACIDADE
  // ==============================

  const colunasAulas = await banco.getAllAsync<{
    name: string;
  }>('PRAGMA table_info(aulas)');

  const possuiCapacidade = colunasAulas.some(
    (coluna) => coluna.name === 'capacidade'
  );

  if (!possuiCapacidade) {
    await banco.execAsync(`
      ALTER TABLE aulas
      ADD COLUMN capacidade INTEGER NOT NULL DEFAULT 0
    `);

    const aulasAntigas = await banco.getAllAsync<{
      id: number;
      vagas: number;
    }>(`
      SELECT id, vagas
      FROM aulas
    `);

    for (const aula of aulasAntigas) {
      const reservas =
        await banco.getFirstAsync<{
          total: number;
        }>(
          `
          SELECT COUNT(*) as total
          FROM reservas
          WHERE aula_id = ?
          `,
          aula.id
        );

      const quantidadeReservada =
        reservas?.total ?? 0;

      const capacidadeCalculada =
        aula.vagas + quantidadeReservada;

      await banco.runAsync(
        `
        UPDATE aulas
        SET capacidade = ?
        WHERE id = ?
        `,
        capacidadeCalculada,
        aula.id
      );
    }
  }

  // ==============================
  // CRIA ADMIN
  // ==============================

  const administrador =
    await banco.getFirstAsync<{ id: number }>(
      `
      SELECT id
      FROM usuarios
      WHERE usuario = ?
      `,
      'admin'
    );

  if (!administrador) {
    await banco.runAsync(
      `
      INSERT INTO usuarios
        (usuario, senha, tipo)
      VALUES (?, ?, ?)
      `,
      'admin',
      'ElloAdmin123',
      'admin'
    );
  }

  // ==============================
  // AULAS INICIAIS
  // ==============================

  const resultado =
    await banco.getFirstAsync<{
      total: number;
    }>(
      `SELECT COUNT(*) as total FROM aulas`
    );

  if (resultado && resultado.total === 0) {
    const aulas = [
      ['Segunda-feira', '18:00', 5],
      ['Segunda-feira', '20:00', 3],
      ['Terca-feira', '18:00', 4],
      ['Terca-feira', '19:00', 2],
      ['Quarta-feira', '18:00', 6],
      ['Quinta-feira', '20:00', 5],
    ];

    for (const aula of aulas) {
      await banco.runAsync(
        `
        INSERT INTO aulas
          (dia, horario, quadra, vagas, capacidade)
        VALUES (?, ?, ?, ?, ?)
        `,
        aula[0],
        aula[1],
        '',
        aula[2],
        aula[2]
      );
    }
  }

  return banco;
}

// ==============================
// USUÁRIOS
// ==============================

export async function cadastrarUsuario(
  usuario: string,
  senha: string
) {
  const db = await inicializarBanco();

  try {
    const resultado = await db.runAsync(
      `
      INSERT INTO usuarios
        (usuario, senha, tipo)
      VALUES (?, ?, ?)
      `,
      usuario,
      senha,
      'aluno'
    );

    return resultado.lastInsertRowId;
  } catch (erro) {
    throw new Error('USUARIO_JA_EXISTE');
  }
}

export async function buscarUsuario(
  usuario: string,
  senha: string
) {
  const db = await inicializarBanco();

  const resultado =
    await db.getFirstAsync<{
      id: number;
      usuario: string;
      senha: string;
      tipo: string;
    }>(
      `
      SELECT
        id,
        usuario,
        senha,
        tipo
      FROM usuarios
      WHERE usuario = ?
        AND senha = ?
      `,
      usuario,
      senha
    );

  return resultado ?? null;
}

export async function buscarUsuarioPorNome(
  usuario: string
) {
  const db = await inicializarBanco();

  const resultado =
    await db.getFirstAsync<{
      id: number;
      usuario: string;
      senha: string;
      tipo: string;
    }>(
      `
      SELECT
        id,
        usuario,
        senha,
        tipo
      FROM usuarios
      WHERE usuario = ?
      `,
      usuario
    );

  return resultado ?? null;
}

// ==============================
// AULAS
// ==============================

export async function buscarAulas() {
  const db = await inicializarBanco();

  const resultado =
    await db.getAllAsync<{
      id: number;
      dia: string;
      horario: string;
      vagas: number;
      capacidade: number;
    }>(
      `
      SELECT
        id,
        dia,
        horario,
        vagas,
        capacidade
      FROM aulas
      ORDER BY id
      `
    );

  return resultado;
}

export async function criarAula(
  dia: string,
  horario: string,
  capacidade: number
) {
  const db = await inicializarBanco();

  await db.runAsync(
    `
    INSERT INTO aulas
      (dia, horario, quadra, vagas, capacidade)
    VALUES (?, ?, ?, ?, ?)
    `,
    dia,
    horario,
    '',
    capacidade,
    capacidade
  );
}

export async function editarAula(
  aulaId: number,
  dia: string,
  horario: string,
  capacidade: number
) {
  const db = await inicializarBanco();

  const reservas =
    await db.getFirstAsync<{
      total: number;
    }>(
      `
      SELECT COUNT(*) as total
      FROM reservas
      WHERE aula_id = ?
      `,
      aulaId
    );

  const quantidadeReservada =
    reservas?.total ?? 0;

  if (capacidade < quantidadeReservada) {
    throw new Error('VAGAS_MENOR_RESERVAS');
  }

  const vagasDisponiveis =
    capacidade - quantidadeReservada;

  await db.runAsync(
    `
    UPDATE aulas
    SET
      dia = ?,
      horario = ?,
      capacidade = ?,
      vagas = ?,
      quadra = ''
    WHERE id = ?
    `,
    dia,
    horario,
    capacidade,
    vagasDisponiveis,
    aulaId
  );
}

export async function excluirAula(
  aulaId: number
) {
  const db = await inicializarBanco();

  const reservas =
    await db.getFirstAsync<{
      total: number;
    }>(
      `
      SELECT COUNT(*) as total
      FROM reservas
      WHERE aula_id = ?
      `,
      aulaId
    );

  if (reservas && reservas.total > 0) {
    throw new Error('AULA_COM_RESERVAS');
  }

  await db.runAsync(
    `DELETE FROM aulas WHERE id = ?`,
    aulaId
  );
}

// ==============================
// MINHAS AULAS
// ==============================

export async function buscarMinhasAulas(
  usuarioId: number
) {
  const db = await inicializarBanco();

  const resultado =
    await db.getAllAsync<{
      id: number;
      dia: string;
      horario: string;
      vagas: number;
      capacidade: number;
      reserva_id: number;
    }>(
      `
      SELECT
        aulas.id,
        aulas.dia,
        aulas.horario,
        aulas.vagas,
        aulas.capacidade,
        reservas.id AS reserva_id
      FROM reservas
      INNER JOIN aulas
        ON aulas.id = reservas.aula_id
      WHERE reservas.usuario_id = ?
      ORDER BY aulas.id
      `,
      usuarioId
    );

  return resultado;
}

// ==============================
// ALUNOS DE CADA AULA
// ==============================

export async function buscarAlunosDaAula(
  aulaId: number
) {
  const db = await inicializarBanco();

  const resultado =
    await db.getAllAsync<{
      id: number;
      usuario: string;
    }>(
      `
      SELECT
        usuarios.id,
        usuarios.usuario
      FROM reservas
      INNER JOIN usuarios
        ON usuarios.id = reservas.usuario_id
      WHERE reservas.aula_id = ?
      ORDER BY usuarios.usuario
      `,
      aulaId
    );

  return resultado;
}

// ==============================
// RESERVAS
// ==============================

export async function reservarAula(
  usuarioId: number,
  aulaId: number
) {
  const db = await inicializarBanco();

  await db.withTransactionAsync(async () => {
    const aula =
      await db.getFirstAsync<{
        vagas: number;
      }>(
        `
        SELECT vagas
        FROM aulas
        WHERE id = ?
        `,
        aulaId
      );

    if (!aula) {
      throw new Error('AULA_NAO_ENCONTRADA');
    }

    if (aula.vagas <= 0) {
      throw new Error('SEM_VAGAS');
    }

    const reservaExistente =
      await db.getFirstAsync<{
        id: number;
      }>(
        `
        SELECT id
        FROM reservas
        WHERE usuario_id = ?
          AND aula_id = ?
        `,
        usuarioId,
        aulaId
      );

    if (reservaExistente) {
      throw new Error('RESERVA_EXISTENTE');
    }

    await db.runAsync(
      `
      INSERT INTO reservas
        (usuario_id, aula_id)
      VALUES (?, ?)
      `,
      usuarioId,
      aulaId
    );

    await db.runAsync(
      `
      UPDATE aulas
      SET vagas = vagas - 1
      WHERE id = ?
      `,
      aulaId
    );
  });
}

export async function cancelarReserva(
  usuarioId: number,
  aulaId: number
) {
  const db = await inicializarBanco();

  await db.withTransactionAsync(async () => {
    const reserva =
      await db.getFirstAsync<{
        id: number;
      }>(
        `
        SELECT id
        FROM reservas
        WHERE usuario_id = ?
          AND aula_id = ?
        `,
        usuarioId,
        aulaId
      );

    if (!reserva) {
      throw new Error('RESERVA_NAO_ENCONTRADA');
    }

    await db.runAsync(
      `
      DELETE FROM reservas
      WHERE usuario_id = ?
        AND aula_id = ?
      `,
      usuarioId,
      aulaId
    );

    await db.runAsync(
      `
      UPDATE aulas
      SET vagas =
        CASE
          WHEN vagas < capacidade
          THEN vagas + 1
          ELSE capacidade
        END
      WHERE id = ?
      `,
      aulaId
    );
  });
}