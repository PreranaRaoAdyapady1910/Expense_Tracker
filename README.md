# Expense Tracker and Fair Share Calculator

A web application for tracking expenses and calculating fair shares for group travel. Built with Express.js, SQLite, and modern frontend technologies.

## Features

- User authentication (signup/login)
- Group creation with multiple members
- Budget preference tracking
- Modern UI with Tailwind CSS
- Responsive design

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd expense-tracker
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

The application will be available at `http://localhost:3000`

## Usage

1. Create an account using the signup page
2. Login with your credentials
3. Create a new group by following the step-by-step process:
   - Enter the number of members
   - Add member names
   - Select budget preferences for each member
4. Submit the form to create the group

## Technologies Used

- Backend:
  - Express.js
  - SQLite3
  - bcrypt for password hashing
  - express-session for session management

- Frontend:
  - HTML5
  - CSS3 with Tailwind CSS
  - Vanilla JavaScript
  - Modern ES6+ features

## Project Structure

```
expense-tracker/
├── public/
│   ├── index.html
│   ├── signup.html
│   ├── dashboard.html
│   └── js/
│       ├── login.js
│       ├── signup.js
│       └── dashboard.js
├── server.js
├── package.json
└── README.md
```

## License

MIT 