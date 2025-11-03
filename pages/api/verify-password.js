export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }

  // Get the password from environment variable
  const appPassword = process.env['front_password'];

  if (!appPassword) {
    console.error('front_password not configured in .env.local');
    return res.status(500).json({ error: 'Password not configured' });
  }

  // Check if the password matches
  const isValid = password === appPassword;

  if (isValid) {
    return res.status(200).json({ success: true });
  } else {
    return res.status(401).json({ error: 'Invalid password' });
  }
}
