-- Keep the public source filter canonical and separate it from a concrete paper title.
ALTER TABLE problem_sources
  ADD COLUMN group_code VARCHAR(32) NOT NULL DEFAULT 'other';

ALTER TABLE problem_sources
  ADD CONSTRAINT ck_problem_sources_group
  CHECK (group_code IN ('national', 'provincial', 'mock', 'textbook', 'other'));

UPDATE problem_sources SET group_code='national'
WHERE code IN ('national-new-1','national-new-2','national-a');
UPDATE problem_sources SET group_code='provincial', label='地方卷' WHERE code='local';
UPDATE problem_sources SET group_code='mock', label='模拟卷' WHERE code='mock';

INSERT INTO problem_sources(code,label,sort_order,active,group_code) VALUES
  ('national-new-1','新高考Ⅰ卷',10,true,'national'),
  ('national-new-2','新高考Ⅱ卷',20,true,'national'),
  ('national-a','全国甲卷',30,true,'national'),
  ('national-b','全国乙卷',40,true,'national'),
  ('national-1','全国Ⅰ卷',50,true,'national'),
  ('national-2','全国Ⅱ卷',60,true,'national'),
  ('national-3','全国Ⅲ卷',70,true,'national'),
  ('national-curriculum-1','新课标Ⅰ卷',80,true,'national'),
  ('national-curriculum-2','新课标Ⅱ卷',90,true,'national'),
  ('gaokao-beijing','北京卷',200,true,'provincial'),
  ('gaokao-tianjin','天津卷',210,true,'provincial'),
  ('gaokao-shanghai','上海卷',220,true,'provincial'),
  ('gaokao-zhejiang','浙江卷',230,true,'provincial'),
  ('gaokao-jiangsu','江苏卷',240,true,'provincial'),
  ('gaokao-hainan','海南卷',250,true,'provincial'),
  ('gaokao-shandong','山东卷',260,true,'provincial'),
  ('gaokao-guangdong','广东卷',270,true,'provincial'),
  ('gaokao-fujian','福建卷',280,true,'provincial'),
  ('gaokao-hubei','湖北卷',290,true,'provincial'),
  ('gaokao-hunan','湖南卷',300,true,'provincial'),
  ('gaokao-hebei','河北卷',310,true,'provincial'),
  ('gaokao-liaoning','辽宁卷',320,true,'provincial'),
  ('gaokao-chongqing','重庆卷',330,true,'provincial'),
  ('gaokao-sichuan','四川卷',340,true,'provincial'),
  ('gaokao-anhui','安徽卷',350,true,'provincial'),
  ('gaokao-jiangxi','江西卷',360,true,'provincial'),
  ('gaokao-shanxi','山西卷',370,true,'provincial'),
  ('gaokao-shaanxi','陕西卷',380,true,'provincial'),
  ('gaokao-henan','河南卷',390,true,'provincial'),
  ('gaokao-heilongjiang','黑龙江卷',400,true,'provincial'),
  ('gaokao-jilin','吉林卷',410,true,'provincial'),
  ('gaokao-neimenggu','内蒙古卷',420,true,'provincial'),
  ('gaokao-guangxi','广西卷',430,true,'provincial'),
  ('gaokao-guizhou','贵州卷',440,true,'provincial'),
  ('gaokao-yunnan','云南卷',450,true,'provincial'),
  ('gaokao-xizang','西藏卷',460,true,'provincial'),
  ('gaokao-gansu','甘肃卷',470,true,'provincial'),
  ('gaokao-qinghai','青海卷',480,true,'provincial'),
  ('gaokao-ningxia','宁夏卷',490,true,'provincial'),
  ('gaokao-xinjiang','新疆卷',500,true,'provincial'),
  ('mock','模拟卷',800,true,'mock'),
  ('original','原创题',900,true,'other'),
  ('textbook','教材题',910,true,'textbook'),
  ('other-exam','其他正式考试',920,true,'other')
ON CONFLICT(code) DO UPDATE SET
  label=excluded.label,
  sort_order=excluded.sort_order,
  active=true,
  group_code=excluded.group_code;

CREATE TABLE problem_source_aliases (
  alias_key VARCHAR(100) PRIMARY KEY,
  alias VARCHAR(100) NOT NULL,
  source_code VARCHAR(64) NOT NULL REFERENCES problem_sources(code)
    ON UPDATE CASCADE ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_problem_source_aliases_source ON problem_source_aliases(source_code);

INSERT INTO problem_source_aliases(alias_key,alias,source_code) VALUES
  ('新高考一','新高考一','national-new-1'),
  ('新高考一卷','新高考一卷','national-new-1'),
  ('新高考1','新高考1','national-new-1'),
  ('新高考1卷','新高考1卷','national-new-1'),
  ('新高考i卷','新高考I卷','national-new-1'),
  ('新高考ⅰ卷','新高考Ⅰ卷','national-new-1'),
  ('新高考二','新高考二','national-new-2'),
  ('新高考二卷','新高考二卷','national-new-2'),
  ('新高考2','新高考2','national-new-2'),
  ('新高考2卷','新高考2卷','national-new-2'),
  ('新高考ii卷','新高考II卷','national-new-2'),
  ('新高考ⅱ卷','新高考Ⅱ卷','national-new-2'),
  ('全国一卷','全国一卷','national-1'),
  ('全国1卷','全国1卷','national-1'),
  ('全国二卷','全国二卷','national-2'),
  ('全国2卷','全国2卷','national-2'),
  ('全国三卷','全国三卷','national-3'),
  ('全国3卷','全国3卷','national-3'),
  ('北京高考','北京高考','gaokao-beijing'),
  ('天津高考','天津高考','gaokao-tianjin'),
  ('上海高考','上海高考','gaokao-shanghai'),
  ('浙江高考','浙江高考','gaokao-zhejiang'),
  ('江苏高考','江苏高考','gaokao-jiangsu'),
  ('模拟题','模拟题','mock'),
  ('模拟卷','模拟卷','mock'),
  ('一模','一模','mock'),
  ('二模','二模','mock'),
  ('三模','三模','mock'),
  ('联考','联考','mock'),
  ('原创','原创','original'),
  ('原创题','原创题','original'),
  ('课本题','课本题','textbook'),
  ('教材题','教材题','textbook')
ON CONFLICT(alias_key) DO UPDATE SET source_code=excluded.source_code,alias=excluded.alias;

ALTER TABLE editorial_papers
  ADD COLUMN source_code VARCHAR(64) REFERENCES problem_sources(code)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  ADD COLUMN exam_year INTEGER CHECK (exam_year BETWEEN 0 AND 9999);

ALTER TABLE problems
  ADD COLUMN original_paper_id UUID REFERENCES editorial_papers(id)
    ON UPDATE CASCADE ON DELETE SET NULL;
CREATE INDEX ix_problems_original_paper ON problems(original_paper_id);

-- Preserve the relationship for already published editorial questions.
UPDATE problems p
SET original_paper_id=i.paper_id
FROM editorial_items i
WHERE i.problem_number=p.problem_number AND i.paper_id IS NOT NULL;

-- Reclassify known variants without deleting their old catalog rows or audit history.
UPDATE problems p SET source_code='mock'
FROM problem_sources s
WHERE p.source_code=s.code AND s.code<>'mock'
  AND (s.label ~ '(模拟|一模|二模|三模|联考|月考|校考)' OR coalesce(p.title,'') ~ '(模拟|一模|二模|三模|联考|月考|校考)');

UPDATE problems p SET source_code=CASE
  WHEN coalesce(s.label,'') || ' ' || coalesce(p.region,'') || ' ' || coalesce(p.title,'') ~ '北京' THEN 'gaokao-beijing'
  WHEN coalesce(s.label,'') || ' ' || coalesce(p.region,'') || ' ' || coalesce(p.title,'') ~ '天津' THEN 'gaokao-tianjin'
  WHEN coalesce(s.label,'') || ' ' || coalesce(p.region,'') || ' ' || coalesce(p.title,'') ~ '上海' THEN 'gaokao-shanghai'
  WHEN coalesce(s.label,'') || ' ' || coalesce(p.region,'') || ' ' || coalesce(p.title,'') ~ '浙江' THEN 'gaokao-zhejiang'
  WHEN coalesce(s.label,'') || ' ' || coalesce(p.region,'') || ' ' || coalesce(p.title,'') ~ '江苏' THEN 'gaokao-jiangsu'
  ELSE p.source_code END
FROM problem_sources s
WHERE p.source_code=s.code;

UPDATE editorial_papers ep
SET source_code=chosen.source_code, exam_year=chosen.exam_year
FROM (
  SELECT i.paper_id,
         (array_agg(p.source_code ORDER BY p.id) FILTER (WHERE p.source_code IS NOT NULL))[1] AS source_code,
         (array_agg(p.year ORDER BY p.id) FILTER (WHERE p.year IS NOT NULL))[1] AS exam_year
  FROM editorial_items i
  JOIN problems p ON p.problem_number=i.problem_number
  WHERE i.paper_id IS NOT NULL
  GROUP BY i.paper_id
) chosen
WHERE ep.id=chosen.paper_id;

UPDATE editorial_papers SET source_code='mock'
WHERE source_code IS NULL AND title ~ '(模拟|一模|二模|三模|联考|月考|校考)';

-- Old dynamic labels that are now fully mapped should no longer appear in the public filter.
UPDATE problem_sources s SET active=false
WHERE s.code LIKE 's-%'
  AND NOT EXISTS (SELECT 1 FROM problems p WHERE p.source_code=s.code);
