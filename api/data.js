// Vercel API - Simple Data Storage
// Stores courses and announcements in memory (resets on deployment)

let sharedData = {
  courses: [
    {
      id: 1735382400000,
      name: 'Excel Basic',
      type: 'beginner',
      videoId: 'RRY-wTT6-ds',
      uploadDate: '12/28/2025'
    }
  ],
  announcements: []
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,PUT,DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { action, type, data, id } = req.body || {};

  try {
    switch (action) {
      case 'get':
        res.status(200).json({ success: true, data: sharedData[type] || [] });
        break;

      case 'add':
        if (type === 'courses') {
          sharedData.courses.push(data);
        } else if (type === 'announcements') {
          sharedData.announcements.unshift(data);
        }
        res.status(200).json({ success: true, data: sharedData[type] });
        break;

      case 'delete':
        if (type === 'courses') {
          sharedData.courses = sharedData.courses.filter(c => c.id !== id);
        }
        res.status(200).json({ success: true, data: sharedData[type] });
        break;

      case 'set':
        sharedData[type] = data;
        res.status(200).json({ success: true, data: sharedData[type] });
        break;

      default:
        res.status(400).json({ success: false, error: 'Invalid action' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}
