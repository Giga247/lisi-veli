# -*- coding: utf-8 -*-
import unittest
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from plan_lib import (
    ring_centroid, point_segment_distance_m, distance_point_to_line_m,
    assign_street_names)

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


def road(osm_id, name, coords, cls=u'residential'):
    return {u'osm_id': osm_id, u'name': name, u'class': cls, u'coords': coords}


def plot(cad, street, lon, lat):
    # პატარა კვადრატი მითითებული ცენტრით
    d = 0.00005
    return {u'cad': cad, u'street': street, u'ring': [
        [lon - d, lat - d], [lon + d, lat - d],
        [lon + d, lat + d], [lon - d, lat + d]]}


# ჰორიზონტალური გზა 41.7450-ზე, 44.7190-დან 44.7210-მდე
ROAD_A = road(1, u'', [[44.7190, 41.7450], [44.7210, 41.7450]])
# შორეული გზა — 41.7470-ზე, ანუ ROAD_A-დან ~222 მ ჩრდილოეთით
ROAD_B = road(2, u'', [[44.7190, 41.7470], [44.7210, 41.7470]])


class TestAssignStreetNames(unittest.TestCase):
    def test_osm_saxeli_yoveltvis_imarjvebs(self):
        roads = [road(1, u'ლეო კვაჭაძის ქუჩა',
                      [[44.7190, 41.7450], [44.7210, 41.7450]])]
        plots = [plot(u'A', u'კედრის ქუჩა', 44.7195, 41.74505),
                 plot(u'B', u'კედრის ქუჩა', 44.7200, 41.74505),
                 plot(u'C', u'კედრის ქუჩა', 44.7205, 41.74505)]
        out = assign_street_names(roads, plots)
        self.assertEqual(out[0][u'name'], u'ლეო კვაჭაძის ქუჩა')
        self.assertEqual(out[0][u'name_src'], u'osm')

    def test_umravlesoba_saxels_wers(self):
        plots = [plot(u'A', u'კედრის I ჩიხი', 44.7195, 41.74505),
                 plot(u'B', u'კედრის I ჩიხი', 44.7200, 41.74505),
                 plot(u'C', u'კედრის I ჩიხი', 44.7205, 41.74505),
                 plot(u'D', u'კედრის ქუჩა', 44.7207, 41.74505)]
        out = assign_street_names([ROAD_A], plots)
        self.assertEqual(out[0][u'name'], u'კედრის I ჩიხი')
        self.assertEqual(out[0][u'name_src'], u'დაშვებული')

    def test_sam_xmaze_naklebi_ar_kmara(self):
        plots = [plot(u'A', u'კედრის I ჩიხი', 44.7195, 41.74505),
                 plot(u'B', u'კედრის I ჩიხი', 44.7200, 41.74505)]
        out = assign_street_names([ROAD_A], plots)
        self.assertEqual(out[0][u'name'], u'')
        self.assertEqual(out[0][u'name_src'], u'')

    def test_gayofili_xmebi_saxels_ar_wers(self):
        # 3 : 3 — არცერთი 60%-ს ვერ აღწევს
        plots = [plot(u'A', u'კედრის I ჩიხი', 44.7192, 41.74505),
                 plot(u'B', u'კედრის I ჩიხი', 44.7194, 41.74505),
                 plot(u'C', u'კედრის I ჩიხი', 44.7196, 41.74505),
                 plot(u'D', u'კედრის ქუჩა', 44.7204, 41.74505),
                 plot(u'E', u'კედრის ქუჩა', 44.7206, 41.74505),
                 plot(u'F', u'კედრის ქუჩა', 44.7208, 41.74505)]
        out = assign_street_names([ROAD_A], plots)
        self.assertEqual(out[0][u'name'], u'')

    def test_shors_myofi_nakvetebi_xmas_ar_azleven(self):
        # ყველა ნაკვეთი ROAD_A-სთანაა; ROAD_B 222 მ-ითაა დაშორებული
        plots = [plot(u'A', u'კედრის I ჩიხი', 44.7195, 41.74505),
                 plot(u'B', u'კედრის I ჩიხი', 44.7200, 41.74505),
                 plot(u'C', u'კედრის I ჩიხი', 44.7205, 41.74505)]
        out = assign_street_names([ROAD_A, ROAD_B], plots)
        self.assertEqual(out[0][u'name'], u'კედრის I ჩიხი')
        self.assertEqual(out[1][u'name'], u'')

    def test_shemomavali_sia_ar_icvleba(self):
        roads = [road(1, u'', [[44.7190, 41.7450], [44.7210, 41.7450]])]
        assign_street_names(roads, [])
        self.assertNotIn(u'name_src', roads[0])


if __name__ == '__main__':
    unittest.main()
