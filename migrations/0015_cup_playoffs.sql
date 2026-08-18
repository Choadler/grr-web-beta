CREATE TABLE IF NOT EXISTS cup_playoff_seasons (
  season_id TEXT PRIMARY KEY REFERENCES cup_seasons(id) ON DELETE CASCADE,
  format_name TEXT NOT NULL,
  champion_driver_id INTEGER NOT NULL REFERENCES cup_drivers(srh_driver_id),
  championship_round INTEGER NOT NULL,
  source_note TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cup_playoff_rounds (
  season_id TEXT NOT NULL REFERENCES cup_playoff_seasons(season_id) ON DELETE CASCADE,
  round_key TEXT NOT NULL,
  label TEXT NOT NULL,
  start_round INTEGER NOT NULL,
  end_round INTEGER NOT NULL,
  tracks TEXT NOT NULL,
  advancing_count INTEGER NOT NULL,
  sort_order INTEGER NOT NULL,
  PRIMARY KEY (season_id, round_key)
);

CREATE TABLE IF NOT EXISTS cup_playoff_drivers (
  season_id TEXT NOT NULL REFERENCES cup_playoff_seasons(season_id) ON DELETE CASCADE,
  srh_driver_id INTEGER NOT NULL REFERENCES cup_drivers(srh_driver_id),
  wins INTEGER NOT NULL,
  total_points INTEGER NOT NULL,
  round_of_12_wins INTEGER NOT NULL,
  round_of_12_points INTEGER NOT NULL,
  round_of_8_wins INTEGER NOT NULL,
  round_of_8_points INTEGER NOT NULL,
  final_cutoff TEXT NOT NULL,
  playoff_points INTEGER NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('champion','championship-four','round-of-8','round-of-12')),
  sort_order INTEGER NOT NULL,
  PRIMARY KEY (season_id, srh_driver_id)
);

INSERT INTO cup_playoff_seasons(season_id,format_name,champion_driver_id,championship_round,source_note)
VALUES ('srh-26393','NASCAR Playoffs',44367,18,'Historical playoff snapshot supplied by GRR league administration.')
ON CONFLICT(season_id) DO UPDATE SET format_name=excluded.format_name,champion_driver_id=excluded.champion_driver_id,championship_round=excluded.championship_round,source_note=excluded.source_note;

INSERT INTO cup_playoff_rounds(season_id,round_key,label,start_round,end_round,tracks,advancing_count,sort_order) VALUES
  ('srh-26393','round-of-12','Round of 12',12,14,'New Hampshire|Kansas|Charlotte Roval',8,1),
  ('srh-26393','round-of-8','Round of 8',15,17,'Las Vegas|Talladega|Martinsville',4,2),
  ('srh-26393','championship','Championship Race',18,18,'Phoenix',1,3)
ON CONFLICT(season_id,round_key) DO UPDATE SET label=excluded.label,start_round=excluded.start_round,end_round=excluded.end_round,tracks=excluded.tracks,advancing_count=excluded.advancing_count,sort_order=excluded.sort_order;

INSERT INTO cup_playoff_drivers(season_id,srh_driver_id,wins,total_points,round_of_12_wins,round_of_12_points,round_of_8_wins,round_of_8_points,final_cutoff,playoff_points,outcome,sort_order) VALUES
  ('srh-26393',44367,6,656,1,187,1,145,'ADV',48,'champion',1),
  ('srh-26393',77857,1,501,0,113,1,111,'ADV',6,'championship-four',2),
  ('srh-26393',83549,2,586,1,165,0,135,'+27',26,'championship-four',3),
  ('srh-26393',85070,0,549,0,119,0,111,'+3',5,'championship-four',4),
  ('srh-26393',54030,0,572,0,105,0,108,'-3',12,'round-of-8',5),
  ('srh-26393',82944,0,542,0,112,0,101,'-10',6,'round-of-8',6),
  ('srh-26393',89819,0,533,0,96,0,101,'-10',7,'round-of-8',7),
  ('srh-26393',115093,0,449,0,108,0,48,'-63',2,'round-of-8',8),
  ('srh-26393',79248,0,471,0,88,0,0,'-20',8,'round-of-12',9),
  ('srh-26393',93172,1,265,0,86,0,0,'-22',5,'round-of-12',10),
  ('srh-26393',116462,0,371,0,79,0,0,'-29',0,'round-of-12',11),
  ('srh-26393',82593,1,429,0,62,0,0,'-46',7,'round-of-12',12)
ON CONFLICT(season_id,srh_driver_id) DO UPDATE SET wins=excluded.wins,total_points=excluded.total_points,round_of_12_wins=excluded.round_of_12_wins,round_of_12_points=excluded.round_of_12_points,round_of_8_wins=excluded.round_of_8_wins,round_of_8_points=excluded.round_of_8_points,final_cutoff=excluded.final_cutoff,playoff_points=excluded.playoff_points,outcome=excluded.outcome,sort_order=excluded.sort_order;
