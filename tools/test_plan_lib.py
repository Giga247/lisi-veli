# -*- coding: utf-8 -*-
import unittest
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from plan_lib import (
    ring_centroid, point_segment_distance_m, distance_point_to_line_m,
    densify, overlap_share)

# ყველა კოორდინატი ლისი ველის განედზეა — 41.745°, სადაც გრძედის
# გრადუსი 83058 მ-ია, განედისა 111320 მ.
LAT0 = 41.745


class TestRingCentroid(unittest.TestCase):
    def test_kvadratis_centri(self):
        ring = [[0.0, 0.0], [2.0, 0.0], [2.0, 2.0], [0.0, 2.0]]
        lon, lat = ring_centroid(ring)
        self.assertAlmostEqual(lon, 1.0, places=9)
        self.assertAlmostEqual(lat, 1.0, places=9)

    def test_dakhuruli_rgoli_ar_shlis_shedegs(self):
        # პირველი და ბოლო წერტილი ერთი და იგივე — GeoJSON-ის ჩვეული ფორმა
        ring = [[0.0, 0.0], [2.0, 0.0], [2.0, 2.0], [0.0, 2.0], [0.0, 0.0]]
        lon, lat = ring_centroid(ring)
        self.assertAlmostEqual(lon, 1.0, places=9)
        self.assertAlmostEqual(lat, 1.0, places=9)

    def test_gadagvarebuli_rgoli_sashualos_abrunebs(self):
        # ნულოვანი ფართობი — ფართობით შეწონა შეუძლებელია
        ring = [[1.0, 1.0], [1.0, 1.0], [1.0, 1.0]]
        lon, lat = ring_centroid(ring)
        self.assertAlmostEqual(lon, 1.0, places=9)
        self.assertAlmostEqual(lat, 1.0, places=9)


class TestDistance(unittest.TestCase):
    def test_perpendikuluri_manzili_metrebshi(self):
        # წერტილი 0.001° ჩრდილოეთით ჰორიზონტალური მონაკვეთიდან
        d = point_segment_distance_m(
            [44.7200, 41.7460], [44.7190, 41.7450], [44.7210, 41.7450], LAT0)
        self.assertAlmostEqual(d, 111.32, places=1)

    def test_monakvetis_gareshe_bolo_wertils_ezomeba(self):
        # წერტილი მონაკვეთის მარჯვნივაა — უახლოესი არის ბოლო წვერო
        d = point_segment_distance_m(
            [44.7220, 41.7450], [44.7190, 41.7450], [44.7210, 41.7450], LAT0)
        self.assertAlmostEqual(d, 83.06, places=1)

    def test_nulovani_monakveti(self):
        d = point_segment_distance_m(
            [44.7210, 41.7450], [44.7200, 41.7450], [44.7200, 41.7450], LAT0)
        self.assertAlmostEqual(d, 83.06, places=1)

    def test_xazi_uaxloes_monakvets_irchevs(self):
        coords = [[44.7190, 41.7450], [44.7210, 41.7450], [44.7210, 41.7470]]
        d = distance_point_to_line_m([44.7211, 41.7460], coords, LAT0)
        self.assertAlmostEqual(d, 8.31, places=1)


# ჰორიზონტალური ქუჩა 41.7450-ზე, 44.7190-დან 44.7210-მდე (~166 მ)
STREET = [[44.7190, 41.7450], [44.7210, 41.7450]]


class TestDensify(unittest.TestCase):
    def test_bijs_icavs(self):
        points = densify(STREET, 10.0, LAT0)
        gaps = [point_segment_distance_m(points[i], points[i + 1],
                                         points[i + 1], LAT0)
                for i in range(len(points) - 1)]
        self.assertTrue(all(g <= 10.5 for g in gaps), gaps)
        self.assertEqual(points[0], STREET[0])
        self.assertEqual(points[-1], STREET[-1])

    def test_ert_wertils_ar_ashlis(self):
        self.assertEqual(densify([[44.719, 41.745]], 5.0, LAT0),
                         [[44.719, 41.745]])


class TestOverlapShare(unittest.TestCase):
    def test_dublikati_erts_ubrundeba(self):
        # იგივე ხაზი, 2 მ-ით ჩრდილოეთით გაწეული
        near = [[44.7190, 41.74502], [44.7210, 41.74502]]
        self.assertAlmostEqual(overlap_share(near, [STREET], LAT0), 1.0)

    def test_shoreuli_gza_nuls_ubrundeba(self):
        far = [[44.7190, 41.7470], [44.7210, 41.7470]]
        self.assertAlmostEqual(overlap_share(far, [STREET], LAT0), 0.0)

    def test_naxevrad_gadamfaravi_shua_shedegs_izlevs(self):
        # პირველი ნახევარი ქუჩაზეა, მეორე 222 მ-ით ჩრდილოეთით
        half = [[44.7190, 41.74501], [44.7200, 41.74501], [44.7200, 41.7470]]
        share = overlap_share(half, [STREET], LAT0)
        self.assertTrue(0.25 < share < 0.55, share)

    def test_carieli_sia_nulia(self):
        self.assertEqual(overlap_share(STREET, [], LAT0), 0.0)


if __name__ == '__main__':
    unittest.main()
