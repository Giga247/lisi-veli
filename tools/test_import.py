# -*- coding: utf-8 -*-
import unittest
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from import_lib import (split_name, normalize_phone, normalize_cad,
                        phones_from_rows)


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


from import_lib import (
    split_name, dedupe_by_cad, geometry_string, index_features_by_cad)


class TestIndexFeaturesByCad(unittest.TestCase):
    def test_dublikatis_gareshe(self):
        features = [
            {u'properties': {u'cad': u'A'}},
            {u'properties': {u'cad': u'B'}},
        ]
        index, dups, missing = index_features_by_cad(features)
        self.assertEqual(len(index), 2)
        self.assertEqual(dups, [])
        self.assertEqual(missing, 0)

    def test_erti_dublikati_pirveli_rcheba_da_erti_registrirdeba(self):
        first = {u'properties': {u'cad': u'X'}, u'tag': u'პირველი'}
        second = {u'properties': {u'cad': u'X'}, u'tag': u'meore'}
        third = {u'properties': {u'cad': u'X'}, u'tag': u'mesame'}
        index, dups, missing = index_features_by_cad([first, second, third])
        self.assertEqual(len(index), 1)
        self.assertEqual(dups, [u'X'])
        self.assertEqual(index[u'X'][u'tag'], u'პირველი')
        self.assertEqual(missing, 0)

    def test_properties_gareshe_feature_ricxvashi_erteba(self):
        features = [{u'geometry': {}}]
        index, dups, missing = index_features_by_cad(features)
        self.assertEqual(len(index), 0)
        self.assertEqual(dups, [])
        self.assertEqual(missing, 1)

    def test_cad_gareshe_properties_ricxvashi_erteba(self):
        features = [{u'properties': {u'other': u'val'}}]
        index, dups, missing = index_features_by_cad(features)
        self.assertEqual(len(index), 0)
        self.assertEqual(dups, [])
        self.assertEqual(missing, 1)

    def test_carieli_siachume(self):
        index, dups, missing = index_features_by_cad([])
        self.assertEqual(index, {})
        self.assertEqual(dups, [])
        self.assertEqual(missing, 0)


if __name__ == '__main__':
    unittest.main()


class TestPhones(unittest.TestCase):
    def test_qartuli_ombra_prefiqsit(self):
        self.assertEqual(normalize_phone(u'555123456'), u'+995555123456')
        self.assertEqual(normalize_phone(u'995555123456'), u'+995555123456')

    def test_gamotovebebi_da_defisebi_irecxeba(self):
        self.assertEqual(normalize_phone(u'555 12-34-56'), u'+995555123456')

    def test_saertashoriso_uzvlelad_rcheba(self):
        self.assertEqual(normalize_phone(u'+44 7700 900123'), u'+447700900123')

    def test_arasruli_nomeri_carielia(self):
        self.assertEqual(normalize_phone(u'12345'), u'')
        self.assertEqual(normalize_phone(u''), u'')
        self.assertEqual(normalize_phone(None), u'')

    def test_atnishna_nomeri_plusis_gareshe_uaryofilia(self):
        # ეს ტიპოა, არა უცხოური ნომერი — იგივე წესი, რაც სერვერზე
        self.assertEqual(normalize_phone(u'5551234567'), u'')

    def test_kodi_bolo_otxi_segmentit_ertdeba(self):
        self.assertEqual(normalize_cad(u'01.72.16.097.011'), u'72.16.097.011')
        self.assertEqual(normalize_cad(u'72.16.097.011'), u'72.16.097.011')
        self.assertEqual(normalize_cad(u'72.16.21.719'), u'72.16.21.719')

    def test_phones_from_rows_agebs_rukas(self):
        out, conflicts, skipped = phones_from_rows([
            (u'01.72.16.097.011', u'555123456'),
            (u'72.16.21.719', u'+44 7700 900123'),
        ])
        self.assertEqual(out[u'72.16.097.011'], u'+995555123456')
        self.assertEqual(out[u'72.16.21.719'], u'+447700900123')
        self.assertEqual(conflicts, [])

    def test_ori_sxvadasxva_nomeri_ert_nakvetze_konfliqtia(self):
        out, conflicts, skipped = phones_from_rows([
            (u'72.16.21.719', u'555111111'),
            (u'72.16.21.719', u'555222222'),
        ])
        self.assertEqual(out[u'72.16.21.719'], u'+995555111111')
        self.assertEqual(conflicts, [u'72.16.21.719'])

    def test_igive_nomeri_orjer_konfliqti_araa(self):
        out, conflicts, skipped = phones_from_rows([
            (u'72.16.21.719', u'555111111'),
            (u'72.16.21.719', u'+995 555 11-11-11'),
        ])
        self.assertEqual(conflicts, [])

    def test_uknomro_chanaweri_skipped_shia(self):
        out, conflicts, skipped = phones_from_rows([(u'72.16.21.719', u'')])
        self.assertEqual(out, {})
        self.assertEqual(skipped, [u'72.16.21.719'])
