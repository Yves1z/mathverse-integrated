-- Admin-editable presentation settings for the official practice-list chart.
-- Single row (id = 1); every field is rendered by the training page.
CREATE TABLE practice_list_display_settings (
  id SMALLINT PRIMARY KEY,
  heading VARCHAR(60) NOT NULL,
  description VARCHAR(200) NOT NULL,
  base_color VARCHAR(9) NOT NULL,
  progress_color VARCHAR(9) NOT NULL,
  text_color VARCHAR(9) NOT NULL,
  bar_height SMALLINT NOT NULL,
  blend_percent SMALLINT NOT NULL,
  sort_direction VARCHAR(4) NOT NULL,
  show_problem_count BOOLEAN NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT ck_practice_display_singleton CHECK (id = 1),
  CONSTRAINT ck_practice_display_base_color CHECK (base_color ~ '^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$'),
  CONSTRAINT ck_practice_display_progress_color CHECK (progress_color ~ '^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$'),
  CONSTRAINT ck_practice_display_text_color CHECK (text_color ~ '^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$'),
  CONSTRAINT ck_practice_display_bar_height CHECK (bar_height BETWEEN 20 AND 120),
  CONSTRAINT ck_practice_display_blend CHECK (blend_percent BETWEEN 0 AND 30),
  CONSTRAINT ck_practice_display_sort CHECK (sort_direction IN ('asc', 'desc'))
);

INSERT INTO practice_list_display_settings (
  id, heading, description, base_color, progress_color, text_color,
  bar_height, blend_percent, sort_direction, show_problem_count
) VALUES (
  1,
  '官方题单',
  '由数海首位用户负责维护，所有人均可查看和打印。',
  '#dbe9f7',
  '#a9c9e8',
  '#123047',
  40,
  8,
  'asc',
  TRUE
);
