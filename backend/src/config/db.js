import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const pool = mysql.createPool({
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
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export default pool;
