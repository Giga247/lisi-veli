# -*- coding: utf-8 -*-
import unittest
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from import_lib import split_name


class TestSplitName(unittest.TestCase):
    def test_ori_sityva_gvari_pirveli(self):
        # xlsx-ში სვეტი ჰქვია „გვარი სახელი" — გვარი პირველია
        self.assertEqual(split_name(u'ბერიძე ზურაბ'), (u'ბერიძე', u'ზურაბ'))

    def test_sami_sityva_danarcheni_saxelia(self):
        self.assertEqual(
            split_name(u'ფარიდი ნადირი რეზაევი'),
            (u'ფარიდი', u'ნადირი რეზაევი'))

    def test_erti_sityva_mxolod_gvari(self):
        self.assertEqual(split_name(u'ბერიძე'), (u'ბერიძე', u''))

    def test_zedmeti_gamotoveba_irecxeba(self):
        self.assertEqual(split_name(u'  ბერიძე   ზურაბ  '), (u'ბერიძე', u'ზურაბ'))

    def test_carieli(self):
        self.assertEqual(split_name(u''), (u'', u''))
        self.assertEqual(split_name(None), (u'', u''))


from import_lib import split_name, dedupe_by_cad


class TestDedupe(unittest.TestCase):
    def test_dublikati_ertdeba_da_ibechdeba(self):
        rows = [
            {u'cad': u'99.99.99.003', u'name': u'ხარაძე ქეთევან'},
            {u'cad': u'99.99.99.002', u'name': u'ბერიძე ზურაბ'},
            {u'cad': u'99.99.99.003', u'name': u'ხარაძე ქეთევან'},
        ]
        result, dups = dedupe_by_cad(rows)
        self.assertEqual(len(result), 2)
        self.assertEqual(dups, [u'99.99.99.003'])
        self.assertEqual(result[u'99.99.99.003'][u'name'], u'ხარაძე ქეთევან')

    def test_carieli_cad_gamoiricxeba(self):
        rows = [{u'cad': u'', u'name': u'X'}, {u'cad': None, u'name': u'Y'}]
        result, dups = dedupe_by_cad(rows)
        self.assertEqual(len(result), 0)
        self.assertEqual(dups, [])

    def test_dublikatebis_gareshe(self):
        rows = [{u'cad': u'A', u'name': u'1'}, {u'cad': u'B', u'name': u'2'}]
        result, dups = dedupe_by_cad(rows)
        self.assertEqual(len(result), 2)
        self.assertEqual(dups, [])


from import_lib import split_name, dedupe_by_cad, geometry_string


class TestGeometryString(unittest.TestCase):
    def test_polygon_mxolod_koordinatebs_inaxavs(self):
        feature = {
            u'geometry': {
                u'type': u'Polygon',
                u'coordinates': [[[44.72, 41.74], [44.73, 41.74],
                                  [44.73, 41.75], [44.72, 41.74]]]
            }
        }
        out = geometry_string(feature)
        self.assertTrue(out.startswith(u'[[['))
        self.assertNotIn(u'Polygon', out)
        self.assertNotIn(u' ', out)  # კომპაქტური, უჯრაში ადგილის დასაზოგად

    def test_ararsebuli_feature_carielia(self):
        self.assertEqual(geometry_string(None), u'')

    def test_ucnobi_tipi_carielia(self):
        feature = {u'geometry': {u'type': u'Point', u'coordinates': [44.7, 41.7]}}
        self.assertEqual(geometry_string(feature), u'')


if __name__ == '__main__':
    unittest.main()
