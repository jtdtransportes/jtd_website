import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

export const DB_TIMEZONE = process.env.DB_TIMEZONE || "-03:00";
const configuredConnections = new WeakSet();

const basePool = mysql.createPool({
  // aqui estava o código como era antes:
  // host: process.env.DB_HOST,
  host: process.env.DB_HOST || "localhost",
  // aqui estava o código como era antes:
  // port: Number(process.env.DB_PORT || 3306),
  port: Number(process.env.DB_PORT || 3306),
  // aqui estava o código como era antes:
  // user: process.env.DB_USER,
  user: process.env.DB_USER || "root",
  // aqui estava o código como era antes:
  // password: process.env.DB_PASSWORD,
  password: process.env.DB_PASSWORD ?? "",
  // aqui estava o código como era antes:
  // database: process.env.DB_NAME,
  database: process.env.DB_NAME || "jtd_website",
  timezone: DB_TIMEZONE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function getTimezoneAwareConnection() {
  const connection = await basePool.getConnection();
  const connectionKey = connection.connection || connection;

  if (!configuredConnections.has(connectionKey)) {
    await connection.query("SET time_zone = ?", [DB_TIMEZONE]);
    configuredConnections.add(connectionKey);
  }

  return connection;
}

const pool = {
  async execute(sql, params) {
    const connection = await getTimezoneAwareConnection();

    try {
      return await connection.execute(sql, params);
    } finally {
      connection.release();
    }
  },

  async query(sql, params) {
    const connection = await getTimezoneAwareConnection();

    try {
      return await connection.query(sql, params);
    } finally {
      connection.release();
    }
  },

  getConnection: getTimezoneAwareConnection,
  end: (...args) => basePool.end(...args),
};

export default pool;
