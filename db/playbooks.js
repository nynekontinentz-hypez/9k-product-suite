const fs = require('fs');
const path = require('path');

const PLAYBOOKS_DIR = path.join(__dirname, '..', 'playbooks');

module.exports = {
  findAll: () => {
    if (!fs.existsSync(PLAYBOOKS_DIR)) return [];
    return fs.readdirSync(PLAYBOOKS_DIR)
      .filter(f => f.endsWith('.md') && f !== 'master-playbook-template.md')
      .map(f => ({
        id: f.replace('.md', ''),
        name: f.replace('.md', '').replace(/-/g, ' ').replace(/\d+/g, '').trim(),
        filename: f
      }));
  },

  findByIndustry: (industry) => {
    if (!industry || !fs.existsSync(PLAYBOOKS_DIR)) return null;
    const playbooks = fs.readdirSync(PLAYBOOKS_DIR).filter(f => f.endsWith('.md'));
    const target = industry.toLowerCase();
    
    // Try to find a playbook that contains the industry name
    const match = playbooks.find(f => f.toLowerCase().includes(target) || target.includes(f.toLowerCase().replace('.md', '').replace(/\d+/g, '').replace(/-/g, ' ').trim()));
    
    if (match) {
      const content = fs.readFileSync(path.join(PLAYBOOKS_DIR, match), 'utf8');
      return {
        id: match.replace('.md', ''),
        name: match.replace('.md', '').replace(/-/g, ' ').replace(/\d+/g, '').trim(),
        content
      };
    }
    return null;
  }
};
