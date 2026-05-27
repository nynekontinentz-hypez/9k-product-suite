const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { requireAdmin } = require('../middleware/auth');

router.use(requireAdmin);

const PLAYBOOKS_DIR = path.join(__dirname, '..', 'playbooks');

router.get('/', (req, res) => {
  const files = fs.readdirSync(PLAYBOOKS_DIR)
    .filter(f => f.endsWith('.md') && f !== 'master-playbook-template.md')
    .map(f => ({
      id: f.replace('.md', ''),
      name: f.replace('.md', '').replace(/-/g, ' ').replace(/\d+/g, '').trim(),
      filename: f
    }));
  
  res.render('admin/playbooks', { user: req.session.admin, playbooks: files, activePath: '/admin/playbooks' });
});

router.get('/:id', (req, res) => {
  const filename = `${req.params.id}.md`;
  const filePath = path.join(PLAYBOOKS_DIR, filename);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Playbook not found');
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  // Simple markdown-to-HTML-ish conversion for preview (or just pass raw and use a library)
  // For now, let's just pass the raw content and render pre-formatted
  res.render('admin/playbook-view', { 
    user: req.session.admin, 
    content, 
    name: req.params.id.replace(/-/g, ' ').replace(/\d+/g, '').trim(),
    activePath: '/admin/playbooks' 
  });
});

module.exports = router;
