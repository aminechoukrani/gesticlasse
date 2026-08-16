-- ============================================================
-- GESTICLASSE — Schéma de base de données MySQL
-- Exécutez ce fichier UNE SEULE FOIS dans phpMyAdmin ou MySQL CLI
-- ============================================================

CREATE DATABASE IF NOT EXISTS gesticlasse
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE gesticlasse;

-- Table des enseignants (administrateurs)
CREATE TABLE IF NOT EXISTS enseignants (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  nom        VARCHAR(100) NOT NULL DEFAULT 'Enseignant',
  email      VARCHAR(150) UNIQUE NOT NULL,
  mot_de_passe VARCHAR(255) NOT NULL,  -- bcrypt hash
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des classes
CREATE TABLE IF NOT EXISTS classes (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  nom        VARCHAR(50) NOT NULL UNIQUE,   -- ex: 1A, 2B, TCS3
  niveau     VARCHAR(50),                   -- ex: 1ère Bac, Tronc Commun
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des élèves
CREATE TABLE IF NOT EXISTS eleves (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  nom           VARCHAR(100) NOT NULL,
  prenom        VARCHAR(100) NOT NULL,
  massar        VARCHAR(20)  NOT NULL UNIQUE,   -- numéro Massar unique
  date_naissance DATE NOT NULL,                  -- utilisé pour la connexion élève
  numero_classe  INT NOT NULL,                   -- numéro de l'élève dans sa classe
  classe_id     INT NOT NULL,
  points        DECIMAL(5,2) DEFAULT 20.00,      -- note sur 20
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (classe_id) REFERENCES classes(id) ON DELETE CASCADE
);

-- Table des remarques
CREATE TABLE IF NOT EXISTS remarques (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  eleve_id    INT NOT NULL,
  enseignant_id INT NOT NULL,
  texte       TEXT NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (eleve_id)     REFERENCES eleves(id) ON DELETE CASCADE,
  FOREIGN KEY (enseignant_id) REFERENCES enseignants(id) ON DELETE CASCADE
);

-- Table de l'historique des points (audit trail)
CREATE TABLE IF NOT EXISTS historique_points (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  eleve_id      INT NOT NULL,
  enseignant_id INT NOT NULL,
  ancienne_note DECIMAL(5,2),
  nouvelle_note DECIMAL(5,2),
  delta         DECIMAL(5,2),
  motif         VARCHAR(255),
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (eleve_id)     REFERENCES eleves(id) ON DELETE CASCADE,
  FOREIGN KEY (enseignant_id) REFERENCES enseignants(id) ON DELETE CASCADE
);

-- ============================================================
-- DONNÉES INITIALES
-- ============================================================

-- Compte enseignant par défaut  (mot de passe : )
-- Le hash bcrypt ci-dessous correspond à ""
INSERT INTO enseignants (nom, email, mot_de_passe)
VALUES (
  'Professeur',
  'prof@ecole.ma',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lHHy'
)
ON DUPLICATE KEY UPDATE id=id;

-- 9 classes d'exemple — modifiez selon vos vraies classes
INSERT INTO classes (nom, niveau) VALUES
  ('1A',  'Tronc Commun'),
  ('1B',  'Tronc Commun'),
  ('2A',  '1ère Bac'),
  ('2B',  '1ère Bac'),
  ('3A',  '2ème Bac'),
  ('3B',  '2ème Bac'),
  ('4A',  '2ème Bac'),
  ('4B',  '2ème Bac'),
  ('5A',  '2ème Bac')
ON DUPLICATE KEY UPDATE id=id;
