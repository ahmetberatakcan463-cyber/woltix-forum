-- Woltix Forum Seed Data

INSERT INTO categories (name, slug, description, icon, color, display_order) VALUES
  ('Announcements', 'announcements', 'Official announcements and news', '📢', '#00ff41', 1),
  ('General', 'general', 'General discussion and off-topic chat', '💬', '#8b5cf6', 2),
  ('Web Hacking', 'web-hacking', 'XSS, SQLi, SSRF, IDOR and more', '🌐', '#00ff41', 3),
  ('Reverse Engineering', 'reverse-engineering', 'Malware analysis, binary exploitation, crackmes', '⚙️', '#f59e0b', 4),
  ('Network Security', 'network-security', 'Packet analysis, WiFi, MitM attacks', '📡', '#06b6d4', 5),
  ('OSINT', 'osint', 'Open source intelligence gathering techniques', '🔍', '#10b981', 6),
  ('Bug Bounty', 'bug-bounty', 'Share your findings and methodologies', '💰', '#f59e0b', 7),
  ('CTF', 'ctf', 'Capture The Flag writeups and challenges', '🚩', '#ef4444', 8),
  ('Tools & Scripts', 'tools-scripts', 'Share your custom tools and automation scripts', '🔧', '#8b5cf6', 9),
  ('Marketplace', 'marketplace', 'Buy, sell, trade services and resources', '🛒', '#06b6d4', 10)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO tags (name, color) VALUES
  ('beginner', '#10b981'),
  ('advanced', '#ef4444'),
  ('writeup', '#8b5cf6'),
  ('tool', '#f59e0b'),
  ('tutorial', '#06b6d4'),
  ('question', '#00ff41'),
  ('discussion', '#888888')
ON CONFLICT (name) DO NOTHING;
