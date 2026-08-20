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


if __name__ == '__main__':
    unittest.main()
