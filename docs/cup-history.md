# Cup historical data

Cup history is imported from SimRacerHub series `12921`; public archive, stats, lookup, schedule, standings, and results views read normalized D1 records rather than scraping SRH.

Admins open **Cup Series → Season Manager**, run **Discover SRH Seasons**, then sync selected seasons. Discovery parses SRH's series-season index and retains each external season ID. Sync fetches that season's `get_standings.php` payload, upserts stable schedule, race, participant, and driver IDs, and is safe to rerun. Existing event names are retained when SRH supplies no replacement. One season can be marked active; current Cup pages prefer it and retain the existing live SRH behavior until an active D1 season exists.

Driver identity uses the stable SRH driver ID. Names are display metadata and are never fuzzy-merged. Results retain SRH source identifiers and points as published, including stage sessions and historical bonuses/penalties. Missing fields are stored as `NULL`; career averages exclude missing values rather than converting them to zero.

Migration `0014_cup_history.sql` adds the Cup tables. Apply migrations before using the importer. The admin sync reports duplicate IDs and races without a detectable winner as warnings for manual review.
