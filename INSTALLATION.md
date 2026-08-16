# 🏫 GestiClasse — Guide d'installation Windows + MySQL

## 📋 Ce dont vous avez besoin

| Outil | Téléchargement |
|-------|---------------|
| Node.js (LTS) | https://nodejs.org |
| XAMPP (MySQL + phpMyAdmin) | https://www.apachefriends.org |

---

## ÉTAPE 1 — Installer Node.js

1. Allez sur https://nodejs.org
2. Téléchargez la version **LTS** (ex: 20.x)
3. Lancez l'installateur → Suivant → Suivant → Installer
4. Vérifiez l'installation : ouvrez **CMD** et tapez :
   ```
   node --version
   npm --version
   ```
   Vous devriez voir des numéros de version.

---

## ÉTAPE 2 — Installer XAMPP (MySQL)x

1. Allez sur https://www.apachefriends.org
2. Téléchargez **XAMPP pour Windows**
3. Installez-le (chemin par défaut : `C:\xampp`)
4. Lancez **XAMPP Control Panel**
5. Cliquez **Start** à côté de **MySQL** (et optionnellement Apache)

---

## ÉTAPE 3 — Créer la base de données

1. Ouvrez votre navigateur → allez sur http://localhost/phpmyadmin
2. Cliquez sur **"Importer"** dans le menu du haut
3. Cliquez **Parcourir** et sélectionnez le fichier :
   ```
   gesticlasse/config/schema.sql
   ```
4. Cliquez **Exécuter** en bas de la page
5. Vous devriez voir la base de données **gesticlasse** apparaître à gauche.

---

## ÉTAPE 4 — Configurer le mot de passe MySQL

Ouvrez le fichier `gesticlasse/config/db.js` et modifiez :

```javascript
password: process.env.DB_PASS || '',   // ← mettez votre mot de passe MySQL ici
```

> Par défaut avec XAMPP, l'utilisateur est `root` et le mot de passe est **vide** (laissez `''`).

---

## ÉTAPE 5 — Installer les dépendances Node.js

1. Ouvrez le dossier `gesticlasse` dans l'**Explorateur Windows**
2. Cliquez dans la barre d'adresse, tapez `cmd` et appuyez sur Entrée
3. Dans le CMD qui s'ouvre, tapez :
   ```
   npm install
   ```
4. Attendez que tout soit installé (1-2 minutes).

---

## ÉTAPE 6 — Lancer l'application

Dans le même CMD :
```
npm start
```

Vous devriez voir :
```
✅  GestiClasse démarré sur http://localhost:3000
📡  Accessible depuis le réseau local sur http://<votre-IP>:3000
```

Ouvrez votre navigateur et allez sur : **http://localhost:3000**

---

## ÉTAPE 7 — Accès depuis les postes élèves (réseau école)

Pour que les élèves puissent se connecter depuis d'autres ordinateurs du réseau :

1. Trouvez l'IP de votre PC :
   - Ouvrez CMD → tapez `ipconfig`
   - Notez l'**Adresse IPv4** (ex: `192.168.1.45`)

2. Les élèves ouvrent leur navigateur et tapent :
   ```
   http://192.168.1.45:3000
   ```

> ⚠️ **Important** : votre PC et les postes élèves doivent être sur le **même réseau WiFi/LAN**.

---

## 📂 Structure du projet

```
gesticlasse/
├── server.js              ← Point d'entrée (à lancer)
├── package.json           ← Dépendances
├── config/
│   ├── db.js              ← Configuration MySQL
│   └── schema.sql         ← Structure de la base de données
├── routes/
│   ├── auth.js            ← Connexion enseignant & élève
│   ├── eleves.js          ← CRUD élèves, points, remarques, import/export
│   └── classes.js         ← Gestion des classes
├── middleware/
│   └── auth.js            ← Protection des routes enseignant
└── public/
    └── index.html         ← Interface web (frontend)
```

---

## 🔐 Identifiants par défaut

| Rôle | Identifiant | Mot de passe |
|------|-------------|--------------|
| Élève | N° Massar + Date de naissance | — |

> Changez le mot de passe enseignant dès la première connexion via le bouton 🔑.

---

## 📄 Format du fichier CSV pour importer les élèves

Le fichier doit avoir les colonnes suivantes (séparées par `;` ou `,`) :

```
nom;prenom;classe;numero_classe;massar;date_naissance
AMRANI;Youssef;1A;12;D123456789;2008-05-14
BENALI;Fatima;1A;13;D987654321;2008-11-03
EL IDRISSI;Omar;2B;5;D111222333;2007-03-22
```

- **nom** : nom de famille en majuscules
- **prenom** : prénom
- **classe** : nom de la classe (ex: 1A, 2B, TCS3...)
- **numero_classe** : numéro de l'élève dans la classe
- **massar** : numéro Massar unique
- **date_naissance** : format AAAA-MM-JJ (ex: 2008-05-14)

> Vous pouvez créer ce fichier avec **Excel** et l'enregistrer au format CSV.

---

## 🔄 Démarrage automatique (optionnel)

Pour que GestiClasse démarre automatiquement avec Windows :

1. Installez `pm2` :
   ```
   npm install -g pm2
   pm2-installer
   ```
2. Dans le dossier `gesticlasse` :
   ```
   pm2 start server.js --name gesticlasse
   pm2 save
   pm2 startup
   ```

---

## ❓ Problèmes fréquents

| Problème | Solution |
|----------|----------|
| `Cannot connect to MySQL` | Vérifiez que MySQL est démarré dans XAMPP |
| `Port 3000 already in use` | Changez le port dans `server.js` : `const PORT = 3001` |
| Élève ne peut pas se connecter | Vérifiez que le N° Massar et la date sont exactement comme dans le CSV importé |
| Caractères spéciaux mal affichés | Enregistrez le CSV en **UTF-8** depuis Excel |

---

*GestiClasse v1.0 — Développé pour la gestion de 9 classes / 340 élèves*
