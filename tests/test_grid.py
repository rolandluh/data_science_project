import unittest
import geopandas as gpd
from shapely.geometry import Point, LineString
from src.extract_grid import geometry, category, nearest


class GridTests(unittest.TestCase):
    def test_line_preserved(self):
        shape = geometry({"type": "way", "tags": {"power": "cable"},
                          "geometry": [{"lon": 8, "lat": 49}, {"lon": 9, "lat": 49}]})
        self.assertEqual(shape.geom_type, "LineString")
        self.assertEqual(shape.distance(Point(8, 49)), 0)

    def test_classification(self):
        self.assertEqual(category({"power": "substation", "substation": "transmission"}), "other_station")
        self.assertEqual(category({"power": "substation", "substation": "minor_distribution"}), "distribution")
        self.assertEqual(category({"power": "transformer"}), "other_station")

    def test_relation_hole(self):
        def member(coords, role):
            return {"role": role, "geometry": [{"lon": x, "lat": y} for x, y in coords]}
        shape = geometry({"type": "relation", "members": [
            member([(0, 0), (4, 0), (4, 4), (0, 4), (0, 0)], "outer"),
            member([(1, 1), (2, 1), (2, 2), (1, 2), (1, 1)], "inner"),
        ]})
        self.assertAlmostEqual(shape.area, 15)

    def test_nearest_line_and_ties(self):
        parking = gpd.GeoDataFrame(geometry=[Point(8.7, 49.4)], crs=4326)
        targets = gpd.GeoDataFrame({"osm_ref": ["way/2", "way/1"], "voltage": [None, None]},
                                  geometry=[LineString([(8.7, 49.4), (9, 49.4)])] * 2, crs=4326)
        result = nearest(parking, targets)[0]
        self.assertEqual(result["distance_m"], 0)
        self.assertEqual(result["osm_ref"], "way/1")
        self.assertEqual(nearest(parking, targets.iloc[:0]), {})


if __name__ == "__main__":
    unittest.main()
