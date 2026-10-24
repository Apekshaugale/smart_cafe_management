-- Smart Cafe Management System - MySQL schema
-- The app creates all of this automatically on first start.
-- You can also run this file in MySQL Workbench (File > Open SQL Script > Run).

CREATE DATABASE IF NOT EXISTS cafe_db;
USE cafe_db;

CREATE TABLE IF NOT EXISTS menu_items (
  menu_item_id      INT PRIMARY KEY,
  sort_order        INT NOT NULL DEFAULT 0,
  item_name         VARCHAR(150) NOT NULL,
  category          VARCHAR(50)  NOT NULL,
  price             DECIMAL(10,2) NOT NULL,
  available         CHAR(1) NOT NULL DEFAULT 'Y',
  description       TEXT,
  is_veg            TINYINT(1) NOT NULL DEFAULT 1,
  is_bestseller     TINYINT(1) NOT NULL DEFAULT 0,
  calories          INT NULL,
  prep_time_minutes INT NULL,
  image_url         MEDIUMTEXT NULL
);

CREATE TABLE IF NOT EXISTS cafe_tables (
  table_id         INT PRIMARY KEY,
  sort_order       INT NOT NULL DEFAULT 0,
  table_number     INT NOT NULL,
  capacity         INT NULL,
  floor            VARCHAR(50) NULL,
  status           VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
  current_order_id INT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  order_id       INT PRIMARY KEY,
  sort_order     INT NOT NULL DEFAULT 0,
  table_id       INT NULL,
  table_number   INT NULL,
  customer_name  VARCHAR(100) NULL,
  customer_phone VARCHAR(30) NULL,
  order_status   VARCHAR(20) NOT NULL,
  total_amount   DECIMAL(10,2) NOT NULL,
  payment_method VARCHAR(10) NULL,
  payment_status VARCHAR(10) NULL,
  created_at     VARCHAR(30) NULL,
  notes          TEXT NULL
);

CREATE TABLE IF NOT EXISTS order_items (
  order_item_id BIGINT PRIMARY KEY,
  order_id      INT NOT NULL,
  menu_item_id  INT NULL,
  item_name     VARCHAR(150) NULL,
  quantity      INT NOT NULL,
  unit_price    DECIMAL(10,2) NOT NULL,
  CONSTRAINT fk_order_items_order
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
  setting_key   VARCHAR(50) PRIMARY KEY,
  setting_value TEXT NULL
);
