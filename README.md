# CyberEscape 🔐
### Secure File Sharing Web Application

CyberEscape is a cybersecurity-focused web application designed to make file sharing more secure and controlled. It allows users to upload and share files with encryption, time-based expiration, and activity logging to help protect sensitive information.

The project demonstrates how cryptography, web development, database management, and security auditing can be combined to build a secure file-sharing system.

## ✨ Key Features

- **File Encryption:** Uses AES-256-CTR encryption to protect file contents.
- **Secure File Upload:** Upload files through a web-based interface.
- **Time-Based Expiration:** Configure file expiry using minutes, hours, or days.
- **Automatic File Deletion:** Periodically checks for expired files and removes them.
- **Controlled File Sharing:** Supports sharing files through generated links and associated decryption information.
- **Audit Logging:** Records security-relevant activities such as uploads, downloads, incorrect decryption keys, lockouts, and deletion events.
- **REST API:** Uses a Node.js and Express.js backend to handle file operations.
- **Database Integration:** Stores file metadata and application records in MongoDB.
- **Interactive User Interface:** Built with React and Material UI.
- **API Testing:** Supports endpoint testing using Postman.

## 🛠️ Technology Stack

| Component | Technology |
|---|---|
| Frontend | React.js |
| UI Framework | Material UI |
| HTTP Client | Axios |
| Backend | Node.js, Express.js |
| File Upload | Multer |
| Encryption | Node.js Crypto module |
| Database | MongoDB |
| ODM | Mongoose |
| API Testing | Postman |
| Development Tools | Visual Studio Code, Git, GitHub |

## 🏗️ System Architecture

The application follows a client-server architecture.

1. **Frontend:** Users interact with the React interface to upload, share, and access files.
2. **Backend:** Express.js receives requests and processes file operations.
3. **Encryption Layer:** The backend uses AES-256-CTR to encrypt and decrypt file contents.
4. **Database Layer:** MongoDB stores file metadata and relevant application records.
5. **Expiration Service:** A scheduled process checks for expired files and deletes them.
6. **Audit Layer:** Security-relevant activities are recorded for monitoring and review.

## 📂 Project Structure

The following is an example structure. Adjust it to match the actual folders and files in your repository.

```text
CyberEscape/
├── frontend/
│   ├── public/
│   ├── src/
│   ├── package.json
│   └── ...
├── backend/
│   ├── models/
│   ├── routes/
│   ├── uploads/
│   ├── server.js
│   ├── package.json
│   └── ...
├── .gitignore
└── README.md
```

## ⚙️ Prerequisites

Before running CyberEscape, install the following:

- [Node.js and npm](https://nodejs.org/)
- [MongoDB Community Server](https://www.mongodb.com/try/download/community) or a MongoDB Atlas account
- [Visual Studio Code](https://code.visualstudio.com/)
- [Git](https://git-scm.com/)
- [Postman](https://www.postman.com/) (optional, for API testing)

Verify that Node.js and npm are installed:

```bash
node --version
npm --version
```

## 🚀 How to Run CyberEscape

Follow these steps to run the project locally using Visual Studio Code.

### Step 1: Clone the repository

Open a terminal and run:

```bash
git clone https://github.com/YOUR_USERNAME/CyberEscape.git
cd CyberEscape
```

Replace `YOUR_USERNAME` with your GitHub username and ensure the repository URL matches your actual repository.

Alternatively, open your repository on GitHub, select **Code → HTTPS**, and copy the repository URL.

### Step 2: Configure MongoDB

Start your local MongoDB service or create a database using MongoDB Atlas.

For a local MongoDB installation, a typical connection string is:

```text
mongodb://127.0.0.1:27017/simple-file
```

The database name shown here is an example based on the project configuration. Use the connection string expected by your backend.

### Step 3: Configure the backend

Open a terminal in VS Code and navigate to the backend folder:

```bash
cd backend
npm install
```

Create a `.env` file in the backend directory if your application uses environment variables.

Example configuration:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/simple-file
```

Use the exact variable names expected by your backend code. If the backend requires other variables, such as a frontend URL, configure those as well.

**Important:** Do not commit `.env` files, encryption keys, credentials, or other secrets to GitHub.

### Step 4: Start the backend server

Check the `scripts` section of `backend/package.json` to identify the available start command.

For example, if the project defines a `start` script:

```bash
npm start
```

Or, if it defines a `dev` script:

```bash
npm run dev
```

If neither script exists, use the actual entry point configured in your project, such as:

```bash
node server.js
```

Keep this terminal open while the backend is running.

### Step 5: Configure and start the frontend

Open a **second terminal** in VS Code.

```bash
cd frontend
npm install
```

Start the frontend using the script configured in `frontend/package.json`.

For a project with a `start` script:

```bash
npm start
```

For a project with a `dev` script:

```bash
npm run dev
```

Open the local URL displayed in the terminal. Depending on the frontend configuration, this may be `http://localhost:3000` or `http://localhost:5173`.

Ensure the frontend's API base URL points to the running backend.

### Step 6: Test the application

Once both servers are running:

1. Open the frontend in your browser.
2. Upload a sample file.
3. Verify that the backend processes the upload and encrypts the file as expected.
4. Test file access and decryption using the required key and initialization vector.
5. Configure a short expiration period and verify the expiry behavior.
6. Review audit logs, where supported.
7. Use Postman to test the relevant API endpoints.

**Note:** Exact routes, environment variable names, and npm commands depend on the implementation in your repository. Check the existing source code and `package.json` files if a command differs.

## 🔒 Security Considerations

CyberEscape demonstrates several useful security concepts, but a successful local run does not automatically make an application production-ready.

- **Encryption:** AES-256-CTR provides confidentiality but does not independently authenticate ciphertext. A production implementation should use authenticated encryption, such as AES-256-GCM, or a properly designed encrypt-then-MAC construction.
- **Encryption key handling:** Keep decryption keys separate from stored file metadata wherever possible. Never expose sensitive keys in application logs.
- **Authentication:** Protect file-management operations with appropriate authentication and authorization.
- **File validation:** Validate file types and sizes, generate safe server-side filenames, and prevent path traversal.
- **Secrets management:** Store database credentials and other secrets in environment variables or a dedicated secrets manager.
- **Expiration:** Ensure expired files are inaccessible even if the cleanup process has not yet deleted them.
- **Audit logs:** Avoid logging passwords, decryption keys, or sensitive file contents.
- **Transport security:** Use HTTPS when deploying the application outside a trusted local development environment.

Features such as strong password hashing, secure session management, multi-factor authentication, and malware scanning should only be described as implemented when they are actually present in the codebase.

## 🎯 Project Objectives

- To develop a web-based secure file-sharing application.
- To demonstrate file encryption using cryptographic techniques.
- To implement controlled access and time-based file expiration.
- To record security-relevant activities through audit logging.
- To integrate a modern frontend with a backend API and database.
- To explore practical cybersecurity challenges in file storage and sharing.

## 🔮 Future Enhancements

Potential enhancements include:

- Strong password hashing using bcrypt or Argon2.
- Secure authentication using JWT or server-managed sessions.
- Two-factor authentication (2FA).
- End-to-end encryption in the browser.
- Malware scanning before file storage or sharing.
- An administrative dashboard for security monitoring.
- Email notifications for file sharing and expiration.
- Improved key management and authenticated encryption.

These are proposed enhancements unless they have already been implemented.

## 🎓 Academic Project

**Project Name:** CyberEscape  
**Domain:** Cybersecurity and Web Application Development  
**Project Type:** Full-Stack Web Application  
**Purpose:** Academic project demonstrating secure file-sharing concepts.

## 🤝 Contributing

Contributions and suggestions are welcome.

1. Fork the repository.
2. Create a new branch for your changes.
3. Implement and test your changes.
4. Submit a pull request with a clear description.

## 📄 License

No license has been specified yet. If you plan to make this project open source, consider adding an appropriate license file, such as the MIT License, after deciding how you want others to use and distribute your work.

---

**CyberEscape — Share files with security in mind. 🔐**
