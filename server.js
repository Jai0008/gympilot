const express = require('express');
const cors = require('cors');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// In-Memory Databases
let workoutsDB = [];
let checkinsDB = [];
let membersDB = [
  { id: '#1', name: 'kashish', email: 'kashishgoswami22@gmail.com', phone: '7928288260', plan: '1 Month', trainer: 'None', expiry: '2026-11-15', status: 'ACTIVE' },
  { id: '#2', name: 'Vansh Goswami', email: 'jaigoswami1983@gmail.com', phone: '09990607101', plan: '1 Month', trainer: 'None', expiry: '2026-11-15', status: 'ACTIVE' },
  { id: '#3', name: 'jatin', email: 'jc@234gmail.com', phone: '9292920202', plan: '1 Month', trainer: 'None', expiry: '2026-11-15', status: 'ACTIVE' },
  { id: '#4', name: 'simran', email: 'simran@gmail.com', phone: '8810552442', plan: '1 Month', trainer: 'None', expiry: '2026-11-15', status: 'ACTIVE' }
];

// Base Test Route
app.get('/', (req, res) => {
  res.send('GymPilot Backend Server Running Successfully!');
});

// ==========================================
// ADMIN AUTHENTICATION ROUTE
// ==========================================
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;

  if (username === 'Vansh' && password === 'Vansh@2208') {
    return res.status(200).json({
      success: true,
      message: 'Admin login successful',
      token: 'gympilot_admin_secret_token_2026'
    });
  } else {
    return res.status(401).json({
      success: false,
      message: 'Invalid Admin Username or Password'
    });
  }
});

// ==========================================
// MEMBER REGISTRATION & LOGIN ROUTES
// ==========================================
app.post('/api/users/register', (req, res) => {
  const { name, email, phone, plan } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required!' });
  }

  let member = membersDB.find(m => m.email.toLowerCase() === email.toLowerCase());

  if (member) {
    return res.status(200).json({
      success: true,
      message: 'Member already exists, logging in...',
      user: member
    });
  }

  const generatedName = name || email.split('@')[0];
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + 30);

  const newMember = {
    id: `#${membersDB.length + 1}`,
    name: generatedName,
    email: email,
    phone: phone || '9999999999',
    plan: plan || '1 Month',
    trainer: 'None',
    expiry: expiryDate.toISOString().split('T')[0],
    status: 'ACTIVE'
  };

  membersDB.unshift(newMember);
  console.log(`[NEW MEMBER REGISTERED] Name: ${generatedName}, Email: ${email}`);

  return res.status(201).json({
    success: true,
    message: 'Member registered successfully!',
    user: newMember
  });
});

app.post('/api/users/login', (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required' });
  }

  let member = membersDB.find(m => m.email.toLowerCase() === email.toLowerCase());

  if (!member) {
    const generatedName = email.split('@')[0];
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);

    member = {
      id: `#${membersDB.length + 1}`,
      name: generatedName,
      email: email,
      phone: '9876543210',
      plan: '1 Month',
      trainer: 'None',
      expiry: expiryDate.toISOString().split('T')[0],
      status: 'ACTIVE'
    };
    membersDB.unshift(member);
  }

  return res.status(200).json({
    success: true,
    message: 'Login successful',
    user: member
  });
});

// ==========================================
// MEMBERSHIP & RENEWAL ROUTES
// ==========================================
app.get('/api/members', (req, res) => {
  res.status(200).json(membersDB);
});

app.post('/api/members/renew', (req, res) => {
  const { member_id, duration_months } = req.body;

  if (!member_id) {
    return res.status(400).json({ success: false, message: 'Member ID is required' });
  }

  const monthsToAdd = parseInt(duration_months) || 1;
  const memberIndex = membersDB.findIndex(m => String(m.id) === String(member_id));

  if (memberIndex !== -1) {
    let currentExpiry = new Date(membersDB[memberIndex].expiry);
    const today = new Date();
    
    let startDate = (currentExpiry > today && !isNaN(currentExpiry)) ? currentExpiry : today;
    startDate.setMonth(startDate.getMonth() + monthsToAdd);

    membersDB[memberIndex].expiry = startDate.toISOString().split('T')[0];
    membersDB[memberIndex].status = 'ACTIVE';

    console.log(`[MEMBERSHIP RENEWED] Member ${membersDB[memberIndex].name} extended by ${monthsToAdd} month(s).`);

    return res.status(200).json({
      success: true,
      message: `Membership extended by ${monthsToAdd} month(s)! New Expiry: ${membersDB[memberIndex].expiry}`,
      member: membersDB[memberIndex]
    });
  } else {
    return res.status(200).json({
      success: true,
      message: `Membership extended successfully for Member ID: ${member_id} by ${monthsToAdd} month(s).`
    });
  }
});

// ==========================================
// CHECK-IN ROUTES (REAL-TIME SYNC)
// ==========================================
app.post('/api/checkin', (req, res) => {
  const { user_id, user_name, checkin_time } = req.body;

  const checkinData = {
    id: Date.now(),
    user_id: String(user_id),
    user_name: user_name || 'Member',
    timestamp: checkin_time || new Date().toISOString()
  };

  checkinsDB.push(checkinData);
  console.log(`[CHECK-IN LOGGED] User: ${checkinData.user_name} at ${checkinData.timestamp}`);
  res.status(200).json({ success: true, message: 'Check-in recorded successfully!' });
});

app.get('/api/checkins', (req, res) => {
  res.status(200).json(checkinsDB);
});

// ==========================================
// START SERVER
// ==========================================
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`🚀 GymPilot Backend Server Running on Port ${PORT}`);
  console.log(`🔗 API Base: http://localhost:${PORT}`);
  console.log(`=================================================`);
});