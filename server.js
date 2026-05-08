const express = require("express");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;
const jwtSecret = process.env.JWT_SECRET || "dev-secret-change-in-production";

if (!process.env.DATABASE_URL) {
  console.warn("DATABASE_URL nao definido. Configure para conectar no PostgreSQL.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname)));

const defaultUsers = [
  { username: "Iure", password: "123456" },
  { username: "Aecio", password: "123456" },
  { username: "Jairo", password: "123456" },
];

async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(80) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS cadastros (
      id UUID PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      nome TEXT NOT NULL,
      telefone TEXT NOT NULL,
      cidade TEXT NOT NULL,
      bairro TEXT NOT NULL,
      area_atuacao TEXT NOT NULL,
      estimativa_voto TEXT NOT NULL,
      demanda TEXT NOT NULL,
      estrutura INTEGER NOT NULL,
      foto TEXT,
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  for (const user of defaultUsers) {
    const hash = await bcrypt.hash(user.password, 10);
    await pool.query(
      `
      INSERT INTO users (username, password_hash)
      VALUES ($1, $2)
      ON CONFLICT (username)
      DO UPDATE SET password_hash = EXCLUDED.password_hash
      `,
      [user.username, hash]
    );
  }

  console.log("Banco inicializado e usuarios padrao garantidos.");
}

function createToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, jwtSecret, { expiresIn: "7d" });
}

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return res.status(401).json({ message: "Token ausente." });
  }

  try {
    req.user = jwt.verify(token, jwtSecret);
    next();
  } catch (error) {
    return res.status(401).json({ message: "Token invalido." });
  }
}

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ message: "Usuario e senha sao obrigatorios." });
  }

  try {
    const { rows } = await pool.query("SELECT id, username, password_hash FROM users WHERE LOWER(username) = LOWER($1)", [
      String(username).trim(),
    ]);

    const user = rows[0];
    if (!user) {
      return res.status(401).json({ message: "Credenciais invalidas." });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ message: "Credenciais invalidas." });
    }

    const token = createToken(user);
    return res.json({ token, user: { id: user.id, username: user.username } });
  } catch (error) {
    console.error("Erro no login:", error);
    return res.status(500).json({ message: "Erro interno ao autenticar." });
  }
});

app.get("/api/me", authenticate, async (req, res) => {
  res.json({ user: req.user });
});

app.get("/api/cadastros", authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
      SELECT id, nome, telefone, cidade, bairro, area_atuacao AS "areaAtuacao",
             estimativa_voto AS "estimativaVoto", demanda, estrutura, foto, atualizado_em AS "atualizadoEm"
      FROM cadastros
      WHERE user_id = $1
      ORDER BY atualizado_em DESC
      `,
      [req.user.id]
    );

    res.json({ data: rows });
  } catch (error) {
    console.error("Erro ao listar cadastros:", error);
    res.status(500).json({ message: "Erro ao carregar cadastros." });
  }
});

app.post("/api/cadastros", authenticate, async (req, res) => {
  const payload = req.body || {};
  const estrutura = Number(payload.estrutura);

  if (!payload.nome || !payload.telefone) {
    return res.status(400).json({ message: "Nome e telefone sao obrigatorios." });
  }

  if (!Number.isInteger(estrutura) || estrutura < 0) {
    return res.status(400).json({ message: "Estrutura deve ser um numero inteiro maior ou igual a zero." });
  }

  const id = crypto.randomUUID();

  try {
    const { rows } = await pool.query(
      `
      INSERT INTO cadastros
      (id, user_id, nome, telefone, cidade, bairro, area_atuacao, estimativa_voto, demanda, estrutura, foto, atualizado_em)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      RETURNING id, nome, telefone, cidade, bairro, area_atuacao AS "areaAtuacao",
                estimativa_voto AS "estimativaVoto", demanda, estrutura, foto, atualizado_em AS "atualizadoEm"
      `,
      [
        id,
        req.user.id,
        payload.nome,
        payload.telefone,
        payload.cidade || "",
        payload.bairro || "",
        payload.areaAtuacao || "",
        payload.estimativaVoto || "",
        payload.demanda || "",
        estrutura,
        payload.foto || "",
      ]
    );

    res.status(201).json({ data: rows[0] });
  } catch (error) {
    console.error("Erro ao criar cadastro:", error);
    res.status(500).json({ message: "Erro ao salvar cadastro." });
  }
});

app.put("/api/cadastros/:id", authenticate, async (req, res) => {
  const payload = req.body || {};
  const estrutura = Number(payload.estrutura);

  if (!payload.nome || !payload.telefone) {
    return res.status(400).json({ message: "Nome e telefone sao obrigatorios." });
  }

  if (!Number.isInteger(estrutura) || estrutura < 0) {
    return res.status(400).json({ message: "Estrutura deve ser um numero inteiro maior ou igual a zero." });
  }

  try {
    const { rows } = await pool.query(
      `
      UPDATE cadastros
      SET nome = $1,
          telefone = $2,
          cidade = $3,
          bairro = $4,
          area_atuacao = $5,
          estimativa_voto = $6,
          demanda = $7,
          estrutura = $8,
          foto = $9,
          atualizado_em = NOW()
      WHERE id = $10 AND user_id = $11
      RETURNING id, nome, telefone, cidade, bairro, area_atuacao AS "areaAtuacao",
                estimativa_voto AS "estimativaVoto", demanda, estrutura, foto, atualizado_em AS "atualizadoEm"
      `,
      [
        payload.nome,
        payload.telefone,
        payload.cidade || "",
        payload.bairro || "",
        payload.areaAtuacao || "",
        payload.estimativaVoto || "",
        payload.demanda || "",
        estrutura,
        payload.foto || "",
        req.params.id,
        req.user.id,
      ]
    );

    if (!rows[0]) {
      return res.status(404).json({ message: "Cadastro nao encontrado." });
    }

    res.json({ data: rows[0] });
  } catch (error) {
    console.error("Erro ao atualizar cadastro:", error);
    res.status(500).json({ message: "Erro ao atualizar cadastro." });
  }
});

app.delete("/api/cadastros/:id", authenticate, async (req, res) => {
  try {
    const result = await pool.query("DELETE FROM cadastros WHERE id = $1 AND user_id = $2", [req.params.id, req.user.id]);
    if (!result.rowCount) {
      return res.status(404).json({ message: "Cadastro nao encontrado." });
    }
    return res.status(204).send();
  } catch (error) {
    console.error("Erro ao excluir cadastro:", error);
    return res.status(500).json({ message: "Erro ao excluir cadastro." });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

initDatabase()
  .then(() => {
    app.listen(port, () => {
      console.log(`Servidor ativo na porta ${port}`);
    });
  })
  .catch((error) => {
    console.error("Falha ao iniciar aplicacao:", error);
    process.exit(1);
  });
