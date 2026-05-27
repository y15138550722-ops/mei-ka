import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { getOrderById } from '../../services/mockDataService';
import { exportNotaryImageBlobsToPdf } from '../../shared/utils/notaryPreviewExport';
import type { Order } from '../../shared/types';
import '../license-officer/ChineseTranslationOrders.css';
import './OrderDetail.css';

type PreviewStatus = 'loading' | 'ready' | 'error';

const DEFAULT_NOTICES = [
  '您必须在预定起飞时间前2小时内抵达指定机场，在柜台办理登机手续。您必须出示购买机票时使用的有效身份证。',
  '通过安检时，您必须出示有效的旅行证件、登机证以及收据。',
  '未按顺序使用航班优惠券将被罚款并额外支付票价。',
  '承运人提供的运输及其他服务，但受承运条件约束，特此以参考方式纳入。这些条件可以从发行方获得。对于涉及最终目的地或停留在出发国以外国家的旅客，请注意，相关国际条约和国际条约和运输条件可能限制承运人的责任。',
];

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const sanitizeFilenamePart = (value: string) => value.replace(/[\\/:*?"<>|]/g, '-').trim();

const serializeElementAsXhtml = (element: Element) => new XMLSerializer().serializeToString(element);

const CHINESE_COMPOUND_SURNAMES = ['欧阳', '司马', '上官', '诸葛', '东方', '尉迟', '公孙', '慕容', '夏侯', '司徒'] as const;

const NAME_PINYIN_MAP: Record<string, string> = {
  张: 'ZHANG',
  王: 'WANG',
  李: 'LI',
  赵: 'ZHAO',
  孙: 'SUN',
  周: 'ZHOU',
  吴: 'WU',
  郑: 'ZHENG',
  陈: 'CHEN',
  钱: 'QIAN',
  刘: 'LIU',
  黄: 'HUANG',
  何: 'HE',
  马: 'MA',
  朱: 'ZHU',
  林: 'LIN',
  徐: 'XU',
  高: 'GAO',
  谢: 'XIE',
  韩: 'HAN',
  伟: 'WEI',
  芳: 'FANG',
  明: 'MING',
  丽: 'LI',
  强: 'QIANG',
  杰: 'JIE',
  秀: 'XIU',
  英: 'YING',
  敏: 'MIN',
  浩: 'HAO',
  亮: 'LIANG',
  洋: 'YANG',
  磊: 'LEI',
  欣: 'XIN',
  俊: 'JUN',
  静: 'JING',
  峰: 'FENG',
  蕾: 'LEI',
  宇: 'YU',
  雪: 'XUE',
};

const AIRLINES = [
  { code: 'CA', name: '中国国际航空', ticketPrefix: '999' },
  { code: 'MU', name: '中国东方航空', ticketPrefix: '781' },
  { code: 'CZ', name: '中国南方航空', ticketPrefix: '784' },
  { code: '3U', name: '四川航空', ticketPrefix: '876' },
  { code: 'HU', name: '海南航空', ticketPrefix: '880' },
  { code: 'MF', name: '厦门航空', ticketPrefix: '731' },
  { code: 'JD', name: '首都航空', ticketPrefix: '898' },
  { code: 'EU', name: '成都航空', ticketPrefix: '811' },
] as const;

const DEPARTURE_AIRPORTS = [
  { airport: '首都国际机场', city: '北京', code: 'PEK', provinces: ['北京市'], cities: ['北京市', '北京'], terminal: '3号航站楼' },
  { airport: '滨海国际机场', city: '天津', code: 'TSN', provinces: ['天津市'], cities: ['天津市', '天津'], terminal: '2号航站楼' },
  { airport: '正定国际机场', city: '石家庄', code: 'SJW', provinces: ['河北省'], cities: ['石家庄市', '石家庄'], terminal: 'T2航站楼' },
  { airport: '三女河机场', city: '唐山', code: 'TVS', provinces: ['河北省'], cities: ['唐山市', '唐山'], terminal: '航站楼' },
  { airport: '北戴河机场', city: '秦皇岛', code: 'BPE', provinces: ['河北省'], cities: ['秦皇岛市', '秦皇岛'], terminal: '航站楼' },
  { airport: '邯郸机场', city: '邯郸', code: 'HDG', provinces: ['河北省'], cities: ['邯郸市', '邯郸'], terminal: '航站楼' },
  { airport: '宁远机场', city: '张家口', code: 'ZQZ', provinces: ['河北省'], cities: ['张家口市', '张家口'], terminal: '航站楼' },
  { airport: '普宁机场', city: '承德', code: 'CDE', provinces: ['河北省'], cities: ['承德市', '承德'], terminal: '航站楼' },
  { airport: '武宿国际机场', city: '太原', code: 'TYN', provinces: ['山西省'], cities: ['太原市', '太原'], terminal: '2号航站楼' },
  { airport: '云冈机场', city: '大同', code: 'DAT', provinces: ['山西省'], cities: ['大同市', '大同'], terminal: '航站楼' },
  { airport: '王村机场', city: '长治', code: 'CIH', provinces: ['山西省'], cities: ['长治市', '长治'], terminal: '航站楼' },
  { airport: '张孝机场', city: '运城', code: 'YCU', provinces: ['山西省'], cities: ['运城市', '运城'], terminal: '航站楼' },
  { airport: '五台山机场', city: '忻州', code: 'WUT', provinces: ['山西省'], cities: ['忻州市', '忻州'], terminal: '航站楼' },
  { airport: '尧都机场', city: '临汾', code: 'LFQ', provinces: ['山西省'], cities: ['临汾市', '临汾'], terminal: '航站楼' },
  { airport: '大武机场', city: '吕梁', code: 'LLV', provinces: ['山西省'], cities: ['吕梁市', '吕梁'], terminal: '航站楼' },
  { airport: '白塔国际机场', city: '呼和浩特', code: 'HET', provinces: ['内蒙古自治区'], cities: ['呼和浩特市', '呼和浩特'], terminal: 'T2航站楼' },
  { airport: '东河机场', city: '包头', code: 'BAV', provinces: ['内蒙古自治区'], cities: ['包头市', '包头'], terminal: '航站楼' },
  { airport: '乌海机场', city: '乌海', code: 'WUA', provinces: ['内蒙古自治区'], cities: ['乌海市', '乌海'], terminal: '航站楼' },
  { airport: '玉龙机场', city: '赤峰', code: 'CIF', provinces: ['内蒙古自治区'], cities: ['赤峰市', '赤峰'], terminal: '航站楼' },
  { airport: '通辽机场', city: '通辽', code: 'TGO', provinces: ['内蒙古自治区'], cities: ['通辽市', '通辽'], terminal: '航站楼' },
  { airport: '伊金霍洛国际机场', city: '鄂尔多斯', code: 'DSN', provinces: ['内蒙古自治区'], cities: ['鄂尔多斯市', '鄂尔多斯'], terminal: '航站楼' },
  { airport: '海拉尔机场', city: '呼伦贝尔', code: 'HLD', provinces: ['内蒙古自治区'], cities: ['呼伦贝尔市', '呼伦贝尔'], terminal: '航站楼' },
  { airport: '天吉泰机场', city: '巴彦淖尔', code: 'RLK', provinces: ['内蒙古自治区'], cities: ['巴彦淖尔市', '巴彦淖尔'], terminal: '航站楼' },
  { airport: '乌兰察布机场', city: '乌兰察布', code: 'UCB', provinces: ['内蒙古自治区'], cities: ['乌兰察布市', '乌兰察布'], terminal: '航站楼' },
  { airport: '锡林浩特机场', city: '锡林郭勒', code: 'XIL', provinces: ['内蒙古自治区'], cities: ['锡林郭勒盟', '锡林郭勒', '锡林浩特'], terminal: '航站楼' },
  { airport: '阿拉善左旗机场', city: '阿拉善', code: 'AXF', provinces: ['内蒙古自治区'], cities: ['阿拉善盟', '阿拉善'], terminal: '航站楼' },
  { airport: '桃仙国际机场', city: '沈阳', code: 'SHE', provinces: ['辽宁省'], cities: ['沈阳市', '沈阳'], terminal: 'T3航站楼' },
  { airport: '周水子国际机场', city: '大连', code: 'DLC', provinces: ['辽宁省'], cities: ['大连市', '大连'], terminal: '航站楼' },
  { airport: '腾鳌机场', city: '鞍山', code: 'AOG', provinces: ['辽宁省'], cities: ['鞍山市', '鞍山'], terminal: '航站楼' },
  { airport: '浪头机场', city: '丹东', code: 'DDG', provinces: ['辽宁省'], cities: ['丹东市', '丹东'], terminal: '航站楼' },
  { airport: '锦州湾机场', city: '锦州', code: 'JNZ', provinces: ['辽宁省'], cities: ['锦州市', '锦州'], terminal: '航站楼' },
  { airport: '兰旗机场', city: '营口', code: 'YKH', provinces: ['辽宁省'], cities: ['营口市', '营口'], terminal: '航站楼' },
  { airport: '朝阳机场', city: '朝阳', code: 'CHG', provinces: ['辽宁省'], cities: ['朝阳市', '朝阳'], terminal: '航站楼' },
  { airport: '龙嘉国际机场', city: '长春', code: 'CGQ', provinces: ['吉林省'], cities: ['长春市', '长春'], terminal: '2号航站楼' },
  { airport: '三源浦机场', city: '通化', code: 'TNH', provinces: ['吉林省'], cities: ['通化市', '通化'], terminal: '航站楼' },
  { airport: '长白山机场', city: '白山', code: 'NBS', provinces: ['吉林省'], cities: ['白山市', '白山'], terminal: '航站楼' },
  { airport: '长安机场', city: '白城', code: 'DBC', provinces: ['吉林省'], cities: ['白城市', '白城'], terminal: '航站楼' },
  { airport: '朝阳川国际机场', city: '延边', code: 'YNJ', provinces: ['吉林省'], cities: ['延边朝鲜族自治州', '延边', '延吉'], terminal: '航站楼' },
  { airport: '太平国际机场', city: '哈尔滨', code: 'HRB', provinces: ['黑龙江省'], cities: ['哈尔滨市', '哈尔滨'], terminal: 'T2航站楼' },
  { airport: '三家子机场', city: '齐齐哈尔', code: 'NDG', provinces: ['黑龙江省'], cities: ['齐齐哈尔市', '齐齐哈尔'], terminal: '航站楼' },
  { airport: '兴凯湖机场', city: '鸡西', code: 'JXA', provinces: ['黑龙江省'], cities: ['鸡西市', '鸡西'], terminal: '航站楼' },
  { airport: '萨尔图机场', city: '大庆', code: 'DQA', provinces: ['黑龙江省'], cities: ['大庆市', '大庆'], terminal: '航站楼' },
  { airport: '林都机场', city: '伊春', code: 'LDS', provinces: ['黑龙江省'], cities: ['伊春市', '伊春'], terminal: '航站楼' },
  { airport: '东郊机场', city: '佳木斯', code: 'JMU', provinces: ['黑龙江省'], cities: ['佳木斯市', '佳木斯'], terminal: '航站楼' },
  { airport: '海浪机场', city: '牡丹江', code: 'MDG', provinces: ['黑龙江省'], cities: ['牡丹江市', '牡丹江'], terminal: '航站楼' },
  { airport: '黑河机场', city: '黑河', code: 'HEK', provinces: ['黑龙江省'], cities: ['黑河市', '黑河'], terminal: '航站楼' },
  { airport: '鄂伦春机场', city: '大兴安岭', code: 'OHE', provinces: ['黑龙江省'], cities: ['大兴安岭地区', '大兴安岭'], terminal: '航站楼' },
  { airport: '浦东国际机场', city: '上海', code: 'PVG', provinces: ['上海市'], cities: ['上海市', '上海'], terminal: '2号航站楼' },
  { airport: '禄口国际机场', city: '南京', code: 'NKG', provinces: ['江苏省'], cities: ['南京市', '南京'], terminal: '2号航站楼' },
  { airport: '硕放国际机场', city: '无锡', code: 'WUX', provinces: ['江苏省'], cities: ['无锡市', '无锡', '苏州市', '苏州'], terminal: 'T2航站楼' },
  { airport: '观音国际机场', city: '徐州', code: 'XUZ', provinces: ['江苏省'], cities: ['徐州市', '徐州'], terminal: 'T2航站楼' },
  { airport: '奔牛国际机场', city: '常州', code: 'CZX', provinces: ['江苏省'], cities: ['常州市', '常州'], terminal: '航站楼' },
  { airport: '兴东国际机场', city: '南通', code: 'NTG', provinces: ['江苏省'], cities: ['南通市', '南通'], terminal: '航站楼' },
  { airport: '花果山机场', city: '连云港', code: 'LYG', provinces: ['江苏省'], cities: ['连云港市', '连云港'], terminal: '航站楼' },
  { airport: '涟水国际机场', city: '淮安', code: 'HIA', provinces: ['江苏省'], cities: ['淮安市', '淮安'], terminal: '航站楼' },
  { airport: '南洋国际机场', city: '盐城', code: 'YNZ', provinces: ['江苏省'], cities: ['盐城市', '盐城'], terminal: '航站楼' },
  { airport: '泰州机场', city: '扬州', code: 'YTY', provinces: ['江苏省'], cities: ['扬州市', '扬州', '泰州市', '泰州'], terminal: '航站楼' },
  { airport: '萧山国际机场', city: '杭州', code: 'HGH', provinces: ['浙江省'], cities: ['杭州市', '杭州'], terminal: 'T4航站楼' },
  { airport: '栎社国际机场', city: '宁波', code: 'NGB', provinces: ['浙江省'], cities: ['宁波市', '宁波'], terminal: 'T2航站楼' },
  { airport: '龙湾国际机场', city: '温州', code: 'WNZ', provinces: ['浙江省'], cities: ['温州市', '温州'], terminal: 'T2航站楼' },
  { airport: '义乌机场', city: '金华', code: 'YIW', provinces: ['浙江省'], cities: ['金华市', '金华', '义乌'], terminal: '航站楼' },
  { airport: '普陀山机场', city: '舟山', code: 'HSN', provinces: ['浙江省'], cities: ['舟山市', '舟山'], terminal: '航站楼' },
  { airport: '路桥机场', city: '台州', code: 'HYN', provinces: ['浙江省'], cities: ['台州市', '台州'], terminal: '航站楼' },
  { airport: '衢州机场', city: '衢州', code: 'JUZ', provinces: ['浙江省'], cities: ['衢州市', '衢州'], terminal: '航站楼' },
  { airport: '新桥国际机场', city: '合肥', code: 'HFE', provinces: ['安徽省'], cities: ['合肥市', '合肥'], terminal: '2号航站楼' },
  { airport: '屯溪国际机场', city: '黄山', code: 'TXN', provinces: ['安徽省'], cities: ['黄山市', '黄山'], terminal: '航站楼' },
  { airport: '天柱山机场', city: '安庆', code: 'AQG', provinces: ['安徽省'], cities: ['安庆市', '安庆'], terminal: '航站楼' },
  { airport: '九华山机场', city: '池州', code: 'JUH', provinces: ['安徽省'], cities: ['池州市', '池州', '铜陵市', '铜陵'], terminal: '航站楼' },
  { airport: '阜阳西关机场', city: '阜阳', code: 'FUG', provinces: ['安徽省'], cities: ['阜阳市', '阜阳'], terminal: '航站楼' },
  { airport: '亳州机场', city: '亳州', code: 'BZJ', provinces: ['安徽省'], cities: ['亳州市', '亳州'], terminal: '航站楼' },
  { airport: '长乐国际机场', city: '福州', code: 'FOC', provinces: ['福建省'], cities: ['福州市', '福州'], terminal: '2号航站楼' },
  { airport: '高崎国际机场', city: '厦门', code: 'XMN', provinces: ['福建省'], cities: ['厦门市', '厦门'], terminal: 'T4航站楼' },
  { airport: '晋江国际机场', city: '泉州', code: 'JJN', provinces: ['福建省'], cities: ['泉州市', '泉州'], terminal: '航站楼' },
  { airport: '沙县机场', city: '三明', code: 'SQJ', provinces: ['福建省'], cities: ['三明市', '三明'], terminal: '航站楼' },
  { airport: '武夷山机场', city: '南平', code: 'WUS', provinces: ['福建省'], cities: ['南平市', '南平', '武夷山'], terminal: '航站楼' },
  { airport: '冠豸山机场', city: '龙岩', code: 'LCX', provinces: ['福建省'], cities: ['龙岩市', '龙岩'], terminal: '航站楼' },
  { airport: '昌北国际机场', city: '南昌', code: 'KHN', provinces: ['江西省'], cities: ['南昌市', '南昌'], terminal: 'T2航站楼' },
  { airport: '罗家机场', city: '景德镇', code: 'JDZ', provinces: ['江西省'], cities: ['景德镇市', '景德镇'], terminal: '航站楼' },
  { airport: '庐山机场', city: '九江', code: 'JIU', provinces: ['江西省'], cities: ['九江市', '九江'], terminal: '航站楼' },
  { airport: '黄金机场', city: '赣州', code: 'KOW', provinces: ['江西省'], cities: ['赣州市', '赣州'], terminal: 'T2航站楼' },
  { airport: '井冈山机场', city: '吉安', code: 'JGS', provinces: ['江西省'], cities: ['吉安市', '吉安'], terminal: '航站楼' },
  { airport: '明月山机场', city: '宜春', code: 'YIC', provinces: ['江西省'], cities: ['宜春市', '宜春'], terminal: '航站楼' },
  { airport: '三清山机场', city: '上饶', code: 'SQD', provinces: ['江西省'], cities: ['上饶市', '上饶'], terminal: '航站楼' },
  { airport: '遥墙国际机场', city: '济南', code: 'TNA', provinces: ['山东省'], cities: ['济南市', '济南'], terminal: '2号航站楼' },
  { airport: '胶东国际机场', city: '青岛', code: 'TAO', provinces: ['山东省'], cities: ['青岛市', '青岛'], terminal: '航站楼' },
  { airport: '蓬莱国际机场', city: '烟台', code: 'YNT', provinces: ['山东省'], cities: ['烟台市', '烟台'], terminal: '航站楼' },
  { airport: '潍坊机场', city: '潍坊', code: 'WEF', provinces: ['山东省'], cities: ['潍坊市', '潍坊'], terminal: '航站楼' },
  { airport: '曲阜机场', city: '济宁', code: 'JNG', provinces: ['山东省'], cities: ['济宁市', '济宁'], terminal: '航站楼' },
  { airport: '大水泊机场', city: '威海', code: 'WEH', provinces: ['山东省'], cities: ['威海市', '威海'], terminal: '航站楼' },
  { airport: '山字河机场', city: '日照', code: 'RIZ', provinces: ['山东省'], cities: ['日照市', '日照'], terminal: '航站楼' },
  { airport: '启阳机场', city: '临沂', code: 'LYI', provinces: ['山东省'], cities: ['临沂市', '临沂'], terminal: '航站楼' },
  { airport: '牡丹机场', city: '菏泽', code: 'HZA', provinces: ['山东省'], cities: ['菏泽市', '菏泽'], terminal: '航站楼' },
  { airport: '新郑国际机场', city: '郑州', code: 'CGO', provinces: ['河南省'], cities: ['郑州市', '郑州'], terminal: '2号航站楼' },
  { airport: '北郊机场', city: '洛阳', code: 'LYA', provinces: ['河南省'], cities: ['洛阳市', '洛阳'], terminal: '航站楼' },
  { airport: '姜营机场', city: '南阳', code: 'NNY', provinces: ['河南省'], cities: ['南阳市', '南阳'], terminal: '航站楼' },
  { airport: '明港机场', city: '信阳', code: 'XAI', provinces: ['河南省'], cities: ['信阳市', '信阳'], terminal: '航站楼' },
  { airport: '天河国际机场', city: '武汉', code: 'WUH', provinces: ['湖北省'], cities: ['武汉市', '武汉'], terminal: '3号航站楼' },
  { airport: '武当山机场', city: '十堰', code: 'WDS', provinces: ['湖北省'], cities: ['十堰市', '十堰'], terminal: '航站楼' },
  { airport: '三峡机场', city: '宜昌', code: 'YIH', provinces: ['湖北省'], cities: ['宜昌市', '宜昌'], terminal: '航站楼' },
  { airport: '刘集机场', city: '襄阳', code: 'XFN', provinces: ['湖北省'], cities: ['襄阳市', '襄阳'], terminal: '航站楼' },
  { airport: '许家坪机场', city: '恩施', code: 'ENH', provinces: ['湖北省'], cities: ['恩施土家族苗族自治州', '恩施'], terminal: '航站楼' },
  { airport: '黄花国际机场', city: '长沙', code: 'CSX', provinces: ['湖南省'], cities: ['长沙市', '长沙'], terminal: '2号航站楼' },
  { airport: '荷花机场', city: '张家界', code: 'DYG', provinces: ['湖南省'], cities: ['张家界市', '张家界'], terminal: '航站楼' },
  { airport: '桃花源机场', city: '常德', code: 'CGD', provinces: ['湖南省'], cities: ['常德市', '常德'], terminal: '航站楼' },
  { airport: '南岳机场', city: '衡阳', code: 'HNY', provinces: ['湖南省'], cities: ['衡阳市', '衡阳'], terminal: '航站楼' },
  { airport: '芷江机场', city: '怀化', code: 'HJJ', provinces: ['湖南省'], cities: ['怀化市', '怀化'], terminal: '航站楼' },
  { airport: '零陵机场', city: '永州', code: 'LLF', provinces: ['湖南省'], cities: ['永州市', '永州'], terminal: '航站楼' },
  { airport: '武陵山机场', city: '湘西', code: 'DXJ', provinces: ['湖南省'], cities: ['湘西土家族苗族自治州', '湘西'], terminal: '航站楼' },
  { airport: '白云国际机场', city: '广州', code: 'CAN', provinces: ['广东省'], cities: ['广州市', '广州'], terminal: '1号航站楼' },
  { airport: '丹霞机场', city: '韶关', code: 'HSC', provinces: ['广东省'], cities: ['韶关市', '韶关'], terminal: '航站楼' },
  { airport: '宝安国际机场', city: '深圳', code: 'SZX', provinces: ['广东省'], cities: ['深圳市', '深圳'], terminal: 'T3航站楼' },
  { airport: '金湾机场', city: '珠海', code: 'ZUH', provinces: ['广东省'], cities: ['珠海市', '珠海'], terminal: '航站楼' },
  { airport: '揭阳潮汕国际机场', city: '揭阳', code: 'SWA', provinces: ['广东省'], cities: ['汕头市', '汕头', '潮州市', '潮州', '揭阳市', '揭阳'], terminal: '航站楼' },
  { airport: '湛江吴川机场', city: '湛江', code: 'ZHA', provinces: ['广东省'], cities: ['湛江市', '湛江'], terminal: '航站楼' },
  { airport: '惠州平潭机场', city: '惠州', code: 'HUZ', provinces: ['广东省'], cities: ['惠州市', '惠州'], terminal: '航站楼' },
  { airport: '梅州梅县机场', city: '梅州', code: 'MXZ', provinces: ['广东省'], cities: ['梅州市', '梅州'], terminal: '航站楼' },
  { airport: '佛山沙堤机场', city: '佛山', code: 'FUO', provinces: ['广东省'], cities: ['佛山市', '佛山'], terminal: '航站楼' },
  { airport: '吴圩国际机场', city: '南宁', code: 'NNG', provinces: ['广西壮族自治区'], cities: ['南宁市', '南宁'], terminal: '2号航站楼' },
  { airport: '白莲机场', city: '柳州', code: 'LZH', provinces: ['广西壮族自治区'], cities: ['柳州市', '柳州'], terminal: '航站楼' },
  { airport: '两江国际机场', city: '桂林', code: 'KWL', provinces: ['广西壮族自治区'], cities: ['桂林市', '桂林'], terminal: 'T2航站楼' },
  { airport: '西江机场', city: '梧州', code: 'WUZ', provinces: ['广西壮族自治区'], cities: ['梧州市', '梧州'], terminal: '航站楼' },
  { airport: '福成机场', city: '北海', code: 'BHY', provinces: ['广西壮族自治区'], cities: ['北海市', '北海'], terminal: '航站楼' },
  { airport: '百色巴马机场', city: '百色', code: 'AEB', provinces: ['广西壮族自治区'], cities: ['百色市', '百色'], terminal: '航站楼' },
  { airport: '金城江机场', city: '河池', code: 'HCJ', provinces: ['广西壮族自治区'], cities: ['河池市', '河池'], terminal: '航站楼' },
  { airport: '美兰国际机场', city: '海口', code: 'HAK', provinces: ['海南省'], cities: ['海口市', '海口'], terminal: '2号航站楼' },
  { airport: '凤凰国际机场', city: '三亚', code: 'SYX', provinces: ['海南省'], cities: ['三亚市', '三亚'], terminal: '航站楼' },
  { airport: '博鳌机场', city: '琼海', code: 'BAR', provinces: ['海南省'], cities: ['琼海市', '琼海'], terminal: '航站楼' },
  { airport: '江北国际机场', city: '重庆', code: 'CKG', provinces: ['重庆市'], cities: ['重庆市', '重庆'], terminal: 'T3A航站楼' },
  { airport: '天府国际机场', city: '成都', code: 'TFU', provinces: ['四川省'], cities: ['成都市', '成都'], terminal: '2号航站楼' },
  { airport: '云龙机场', city: '泸州', code: 'LZO', provinces: ['四川省'], cities: ['泸州市', '泸州'], terminal: '航站楼' },
  { airport: '保安营机场', city: '攀枝花', code: 'PZI', provinces: ['四川省'], cities: ['攀枝花市', '攀枝花'], terminal: '航站楼' },
  { airport: '南郊机场', city: '绵阳', code: 'MIG', provinces: ['四川省'], cities: ['绵阳市', '绵阳'], terminal: '航站楼' },
  { airport: '盘龙机场', city: '南充', code: 'NAO', provinces: ['四川省'], cities: ['南充市', '南充'], terminal: '航站楼' },
  { airport: '五粮液机场', city: '宜宾', code: 'YBP', provinces: ['四川省'], cities: ['宜宾市', '宜宾'], terminal: '航站楼' },
  { airport: '河市机场', city: '达州', code: 'DAX', provinces: ['四川省'], cities: ['达州市', '达州'], terminal: '航站楼' },
  { airport: '红原机场', city: '阿坝', code: 'AHJ', provinces: ['四川省'], cities: ['阿坝藏族羌族自治州', '阿坝'], terminal: '航站楼' },
  { airport: '康定机场', city: '甘孜', code: 'KGT', provinces: ['四川省'], cities: ['甘孜藏族自治州', '甘孜', '康定'], terminal: '航站楼' },
  { airport: '青山机场', city: '凉山', code: 'XIC', provinces: ['四川省'], cities: ['凉山彝族自治州', '凉山', '西昌'], terminal: '航站楼' },
  { airport: '龙洞堡国际机场', city: '贵阳', code: 'KWE', provinces: ['贵州省'], cities: ['贵阳市', '贵阳'], terminal: '3号航站楼' },
  { airport: '月照机场', city: '六盘水', code: 'LPF', provinces: ['贵州省'], cities: ['六盘水市', '六盘水'], terminal: '航站楼' },
  { airport: '新舟机场', city: '遵义', code: 'ZYI', provinces: ['贵州省'], cities: ['遵义市', '遵义'], terminal: '航站楼' },
  { airport: '黄果树机场', city: '安顺', code: 'AVA', provinces: ['贵州省'], cities: ['安顺市', '安顺'], terminal: '航站楼' },
  { airport: '飞雄机场', city: '毕节', code: 'BFJ', provinces: ['贵州省'], cities: ['毕节市', '毕节'], terminal: '航站楼' },
  { airport: '凤凰机场', city: '铜仁', code: 'TEN', provinces: ['贵州省'], cities: ['铜仁市', '铜仁'], terminal: '航站楼' },
  { airport: '兴义万峰林机场', city: '黔西南', code: 'ACX', provinces: ['贵州省'], cities: ['黔西南布依族苗族自治州', '黔西南', '兴义'], terminal: '航站楼' },
  { airport: '黄平机场', city: '黔东南', code: 'KJH', provinces: ['贵州省'], cities: ['黔东南苗族侗族自治州', '黔东南', '凯里'], terminal: '航站楼' },
  { airport: '荔波机场', city: '黔南', code: 'LLB', provinces: ['贵州省'], cities: ['黔南布依族苗族自治州', '黔南', '荔波'], terminal: '航站楼' },
  { airport: '长水国际机场', city: '昆明', code: 'KMG', provinces: ['云南省'], cities: ['昆明市', '昆明'], terminal: '1号航站楼' },
  { airport: '昭通机场', city: '昭通', code: 'ZAT', provinces: ['云南省'], cities: ['昭通市', '昭通'], terminal: '航站楼' },
  { airport: '三义国际机场', city: '丽江', code: 'LJG', provinces: ['云南省'], cities: ['丽江市', '丽江'], terminal: '航站楼' },
  { airport: '思茅机场', city: '普洱', code: 'SYM', provinces: ['云南省'], cities: ['普洱市', '普洱'], terminal: '航站楼' },
  { airport: '博尚机场', city: '临沧', code: 'LNJ', provinces: ['云南省'], cities: ['临沧市', '临沧'], terminal: '航站楼' },
  { airport: '保山机场', city: '保山', code: 'BSD', provinces: ['云南省'], cities: ['保山市', '保山'], terminal: '航站楼' },
  { airport: '大理机场', city: '大理', code: 'DLU', provinces: ['云南省'], cities: ['大理白族自治州', '大理'], terminal: '航站楼' },
  { airport: '芒市机场', city: '德宏', code: 'LUM', provinces: ['云南省'], cities: ['德宏傣族景颇族自治州', '德宏', '芒市'], terminal: '航站楼' },
  { airport: '嘎洒国际机场', city: '西双版纳', code: 'JHG', provinces: ['云南省'], cities: ['西双版纳傣族自治州', '西双版纳', '景洪'], terminal: '航站楼' },
  { airport: '香格里拉机场', city: '迪庆', code: 'DIG', provinces: ['云南省'], cities: ['迪庆藏族自治州', '迪庆', '香格里拉'], terminal: '航站楼' },
  { airport: '泸沽湖机场', city: '怒江', code: 'NLH', provinces: ['云南省'], cities: ['怒江傈僳族自治州', '怒江'], terminal: '航站楼' },
  { airport: '贡嘎国际机场', city: '拉萨', code: 'LXA', provinces: ['西藏自治区'], cities: ['拉萨市', '拉萨'], terminal: '3号航站楼' },
  { airport: '和平机场', city: '日喀则', code: 'RKZ', provinces: ['西藏自治区'], cities: ['日喀则市', '日喀则'], terminal: '航站楼' },
  { airport: '邦达机场', city: '昌都', code: 'BPX', provinces: ['西藏自治区'], cities: ['昌都市', '昌都'], terminal: '航站楼' },
  { airport: '米林机场', city: '林芝', code: 'LZY', provinces: ['西藏自治区'], cities: ['林芝市', '林芝'], terminal: '航站楼' },
  { airport: '昆莎机场', city: '阿里', code: 'NGQ', provinces: ['西藏自治区'], cities: ['阿里地区', '阿里'], terminal: '航站楼' },
  { airport: '咸阳国际机场', city: '西安', code: 'XIY', provinces: ['陕西省'], cities: ['西安市', '西安'], terminal: 'T5航站楼' },
  { airport: '城固机场', city: '汉中', code: 'HZG', provinces: ['陕西省'], cities: ['汉中市', '汉中'], terminal: '航站楼' },
  { airport: '榆阳机场', city: '榆林', code: 'UYN', provinces: ['陕西省'], cities: ['榆林市', '榆林'], terminal: '航站楼' },
  { airport: '富县机场', city: '延安', code: 'ENY', provinces: ['陕西省'], cities: ['延安市', '延安'], terminal: '航站楼' },
  { airport: '富强机场', city: '安康', code: 'AKA', provinces: ['陕西省'], cities: ['安康市', '安康'], terminal: '航站楼' },
  { airport: '中川国际机场', city: '兰州', code: 'LHW', provinces: ['甘肃省'], cities: ['兰州市', '兰州'], terminal: '2号航站楼' },
  { airport: '嘉峪关机场', city: '嘉峪关', code: 'JGN', provinces: ['甘肃省'], cities: ['嘉峪关市', '嘉峪关'], terminal: '航站楼' },
  { airport: '麦积山机场', city: '天水', code: 'THQ', provinces: ['甘肃省'], cities: ['天水市', '天水'], terminal: '航站楼' },
  { airport: '金昌机场', city: '金昌', code: 'JIC', provinces: ['甘肃省'], cities: ['金昌市', '金昌'], terminal: '航站楼' },
  { airport: '沙漠公园机场', city: '武威', code: 'WWE', provinces: ['甘肃省'], cities: ['武威市', '武威'], terminal: '航站楼' },
  { airport: '甘州机场', city: '张掖', code: 'YZY', provinces: ['甘肃省'], cities: ['张掖市', '张掖'], terminal: '航站楼' },
  { airport: '敦煌莫高国际机场', city: '酒泉', code: 'DNH', provinces: ['甘肃省'], cities: ['酒泉市', '酒泉', '敦煌'], terminal: '航站楼' },
  { airport: '庆阳机场', city: '庆阳', code: 'IQN', provinces: ['甘肃省'], cities: ['庆阳市', '庆阳'], terminal: '航站楼' },
  { airport: '成县机场', city: '陇南', code: 'LNL', provinces: ['甘肃省'], cities: ['陇南市', '陇南'], terminal: '航站楼' },
  { airport: '夏河机场', city: '甘南', code: 'GXH', provinces: ['甘肃省'], cities: ['甘南藏族自治州', '甘南'], terminal: '航站楼' },
  { airport: '曹家堡国际机场', city: '西宁', code: 'XNN', provinces: ['青海省'], cities: ['西宁市', '西宁'], terminal: '2号航站楼' },
  { airport: '德令哈机场', city: '海西', code: 'HXD', provinces: ['青海省'], cities: ['海西蒙古族藏族自治州', '海西', '德令哈'], terminal: '航站楼' },
  { airport: '格尔木机场', city: '海西', code: 'GOQ', provinces: ['青海省'], cities: ['格尔木'], terminal: '航站楼' },
  { airport: '花土沟机场', city: '海西', code: 'HTT', provinces: ['青海省'], cities: ['花土沟'], terminal: '航站楼' },
  { airport: '玛沁机场', city: '果洛', code: 'GMQ', provinces: ['青海省'], cities: ['果洛藏族自治州', '果洛'], terminal: '航站楼' },
  { airport: '巴塘机场', city: '玉树', code: 'YUS', provinces: ['青海省'], cities: ['玉树藏族自治州', '玉树'], terminal: '航站楼' },
  { airport: '河东国际机场', city: '银川', code: 'INC', provinces: ['宁夏回族自治区'], cities: ['银川市', '银川'], terminal: '3号航站楼' },
  { airport: '香山机场', city: '中卫', code: 'ZHY', provinces: ['宁夏回族自治区'], cities: ['中卫市', '中卫'], terminal: '航站楼' },
  { airport: '地窝堡国际机场', city: '乌鲁木齐', code: 'URC', provinces: ['新疆维吾尔自治区'], cities: ['乌鲁木齐市', '乌鲁木齐'], terminal: 'T3航站楼' },
  { airport: '伊宁机场', city: '伊犁', code: 'YIN', provinces: ['新疆维吾尔自治区'], cities: ['伊犁哈萨克自治州', '伊犁', '伊宁'], terminal: '航站楼' },
  { airport: '克拉玛依机场', city: '克拉玛依', code: 'KRY', provinces: ['新疆维吾尔自治区'], cities: ['克拉玛依市', '克拉玛依'], terminal: '航站楼' },
  { airport: '交河机场', city: '吐鲁番', code: 'TLQ', provinces: ['新疆维吾尔自治区'], cities: ['吐鲁番市', '吐鲁番'], terminal: '航站楼' },
  { airport: '哈密机场', city: '哈密', code: 'HMI', provinces: ['新疆维吾尔自治区'], cities: ['哈密市', '哈密'], terminal: '航站楼' },
  { airport: '库尔勒梨城机场', city: '巴音郭楞', code: 'KRL', provinces: ['新疆维吾尔自治区'], cities: ['巴音郭楞蒙古自治州', '巴音郭楞', '库尔勒'], terminal: '航站楼' },
  { airport: '阿克苏红旗坡机场', city: '阿克苏', code: 'AKU', provinces: ['新疆维吾尔自治区'], cities: ['阿克苏地区', '阿克苏'], terminal: '航站楼' },
  { airport: '喀什徕宁国际机场', city: '喀什', code: 'KHG', provinces: ['新疆维吾尔自治区'], cities: ['喀什地区', '喀什'], terminal: '航站楼' },
  { airport: '和田昆冈机场', city: '和田', code: 'HTN', provinces: ['新疆维吾尔自治区'], cities: ['和田地区', '和田'], terminal: '航站楼' },
  { airport: '塔城千泉机场', city: '塔城', code: 'TCG', provinces: ['新疆维吾尔自治区'], cities: ['塔城地区', '塔城'], terminal: '航站楼' },
  { airport: '阿勒泰雪都机场', city: '阿勒泰', code: 'AAT', provinces: ['新疆维吾尔自治区'], cities: ['阿勒泰地区', '阿勒泰'], terminal: '航站楼' },
  { airport: '石河子花园机场', city: '石河子', code: 'SHF', provinces: ['新疆维吾尔自治区'], cities: ['石河子市', '石河子'], terminal: '航站楼' },
  { airport: '图木舒克唐王城机场', city: '图木舒克', code: 'TWC', provinces: ['新疆维吾尔自治区'], cities: ['图木舒克市', '图木舒克'], terminal: '航站楼' },
  { airport: '香港国际机场', city: '香港', code: 'HKG', provinces: ['香港特别行政区'], cities: ['香港特别行政区', '香港'], terminal: '1号航站楼' },
  { airport: '澳门国际机场', city: '澳门', code: 'MFM', provinces: ['澳门特别行政区'], cities: ['澳门特别行政区', '澳门'], terminal: '客运大楼' },
  { airport: '桃园国际机场', city: '台北', code: 'TPE', provinces: ['台湾省'], cities: ['台北市', '台北'], terminal: '1号航站楼' },
] as const;

const ARRIVAL_AIRPORTS = [
  { airport: '金斯福德·史密斯机场', city: '悉尼', code: 'SYD', country: '澳大利亚', terminal: '1号航站楼' },
  { airport: '奥克兰机场', city: '奥克兰', code: 'AKL', country: '新西兰', terminal: '国际航站楼' },
  { airport: '成田国际机场', city: '东京', code: 'NRT', country: '日本', terminal: '1号航站楼' },
  { airport: '希思罗机场', city: '伦敦', code: 'LHR', country: '英国', terminal: '2号航站楼' },
  { airport: '洛杉矶国际机场', city: '洛杉矶', code: 'LAX', country: '美国', terminal: 'B航站楼' },
  { airport: '温哥华国际机场', city: '温哥华', code: 'YVR', country: '加拿大', terminal: 'M航站楼' },
  { airport: '戴高乐机场', city: '巴黎', code: 'CDG', country: '法国', terminal: '2E航站楼' },
  { airport: '法兰克福机场', city: '法兰克福', code: 'FRA', country: '德国', terminal: '1号航站楼' },
  { airport: '马尔彭萨机场', city: '米兰', code: 'MXP', country: '意大利', terminal: '1号航站楼' },
  { airport: '阿道弗·苏亚雷斯马德里-巴拉哈斯机场', city: '马德里', code: 'MAD', country: '西班牙', terminal: '4号航站楼' },
] as const;

const BASE_FARE_BY_COUNTRY: Record<string, number> = {
  澳大利亚: 4380,
  新西兰: 4680,
  日本: 1980,
  英国: 5290,
  美国: 5680,
  加拿大: 5480,
  法国: 4980,
  德国: 4880,
  意大利: 4380,
  西班牙: 4680,
};

const getDisplayValue = (value?: string | null, fallback = '--') => {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
};

const formatChineseDate = (value?: string | null, fallback = '--') => {
  const normalized = value?.trim();
  if (!normalized) return fallback;

  const matched = normalized.match(/^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/);
  if (!matched) return normalized;

  const [, year, month, day] = matched;
  return `${year}年${Number(month)}月${Number(day)}日`;
};

const formatCurrency = (amount: number) =>
  `人民币${amount.toFixed(2)}元`;

const hashText = (value: string) =>
  Array.from(value).reduce((hash, char) => Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0, 2166136261);

const getSeed = (order: Order, salt = '') => hashText(`${order.orderId}|${order.createdAt}|${salt}`);

const seededInt = (seed: number, min: number, max: number) => min + (seed % (max - min + 1));

const seededItem = <T,>(items: readonly T[], seed: number) => items[seed % items.length];

const nextSeed = (seed: number) => (Math.imul(seed, 1664525) + 1013904223) >>> 0;

const buildSeededDigits = (seed: number, length: number) => {
  let currentSeed = seed;
  let result = '';
  for (let index = 0; index < length; index += 1) {
    currentSeed = nextSeed(currentSeed);
    result += String(currentSeed % 10);
  }
  return result;
};

const buildSeededAlphaNumeric = (seed: number, length: number) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let currentSeed = seed;
  let result = '';
  for (let index = 0; index < length; index += 1) {
    currentSeed = nextSeed(currentSeed);
    result += chars[currentSeed % chars.length];
  }
  return result;
};

const parseOrderDate = (value?: string | null) => {
  const normalized = value?.trim();
  if (!normalized) return null;
  const matched = normalized.match(/^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})(?:[日T\s]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (!matched) return null;
  const [, year, month, day, hour = '0', minute = '0', second = '0'] = matched;
  return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
};

const addDays = (date: Date, days: number) => {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
};

const addMinutes = (date: Date, minutes: number) => {
  const nextDate = new Date(date);
  nextDate.setMinutes(nextDate.getMinutes() + minutes);
  return nextDate;
};

const formatChineseDateFromDate = (date: Date) => `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;

const formatClock = (date: Date) =>
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

const extractIssuingRegion = (address?: string | null) => {
  const normalizedAddress = address?.trim() || '';
  if (!normalizedAddress) {
    return '';
  }

  const provinceMatch = normalizedAddress.match(/^(.{2,8}?(?:省|市|自治区|特别行政区))/);
  const province = provinceMatch?.[1] || '';
  const cityMatch = normalizedAddress.replace(province, '').match(/^(.{1,8}?(?:市|州|区|县))/);
  const city = cityMatch?.[1] || '';

  return [province, city].filter(Boolean).join(' ') || normalizedAddress.slice(0, 12);
};

const splitIssuingRegion = (issuingRegion?: string | null) => {
  const normalizedRegion = issuingRegion?.trim() || '';
  if (!normalizedRegion) {
    return { province: '', city: '' };
  }

  const parts = normalizedRegion.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return {
      province: parts[0],
      city: parts[1],
    };
  }

  const provinceMatch = DEPARTURE_AIRPORTS.find((airport) => airport.provinces.some((province) => normalizedRegion.includes(province)));
  const cityMatch = DEPARTURE_AIRPORTS.find((airport) => airport.cities.some((city) => normalizedRegion.includes(city)));

  return {
    province: provinceMatch?.provinces[0] || '',
    city: cityMatch?.cities[0] || '',
  };
};

const getOrderIssuingRegion = (order: Order) => order.licenseIssuingRegion?.trim() || extractIssuingRegion(order.licenseAddress);

const selectDepartureAirport = (order: Order) => {
  const issuingRegion = getOrderIssuingRegion(order);
  const issuingRegionParts = splitIssuingRegion(issuingRegion);

  return (
    DEPARTURE_AIRPORTS.find((airport) => issuingRegionParts.city && airport.cities.some((city) => issuingRegionParts.city.includes(city))) ||
    DEPARTURE_AIRPORTS.find((airport) => issuingRegionParts.province && airport.provinces.some((province) => issuingRegionParts.province.includes(province))) ||
    DEPARTURE_AIRPORTS.find(
      (airport) =>
        airport.cities.some((city) => issuingRegion.includes(city)) || airport.provinces.some((province) => issuingRegion.includes(province)),
    ) ||
    DEPARTURE_AIRPORTS[0]
  );
};

const selectArrivalAirport = (order: Order, seed: number) => {
  const country = order.useCountry?.trim() || order.domesticLicenseInfo?.foreignCountry?.trim() || '';
  return ARRIVAL_AIRPORTS.find((airport) => country.includes(airport.country)) || seededItem(ARRIVAL_AIRPORTS, seed);
};

const convertChineseNameToPassengerPinyin = (name: string) => {
  const normalizedName = name.replace(/[\s·.。-]/g, '').trim();
  if (!normalizedName || !/^[\u4e00-\u9fff]+$/u.test(normalizedName)) {
    return '';
  }

  const compoundSurname = CHINESE_COMPOUND_SURNAMES.find((surname) => normalizedName.startsWith(surname));
  const surnameLength = compoundSurname ? compoundSurname.length : 1;
  const surname = normalizedName.slice(0, surnameLength);
  const givenName = normalizedName.slice(surnameLength);
  const toPinyin = (value: string) => {
    const tokens = Array.from(value).map((char) => NAME_PINYIN_MAP[char] || '');
    return tokens.every(Boolean) ? tokens.join('') : '';
  };
  const surnamePinyin = toPinyin(surname);
  const givenNamePinyin = toPinyin(givenName);

  return surnamePinyin && givenNamePinyin ? `${surnamePinyin}/${givenNamePinyin}` : '';
};

const buildPassengerName = (order: Order) => {
  const surnamePinyin = order.idpSurnameEn?.trim().toUpperCase();
  const givenNamePinyin = order.idpGivenNameEn?.trim().toUpperCase();
  if (surnamePinyin && givenNamePinyin) {
    return `${surnamePinyin}/${givenNamePinyin}`;
  }

  const licenseName = order.licenseName?.trim() || order.customerName?.trim();
  if (!licenseName) return '--';

  const pinyinName = convertChineseNameToPassengerPinyin(licenseName);
  if (pinyinName) {
    return pinyinName;
  }

  const normalizedLatinName = licenseName.trim().replace(/[/-]+/g, ' ').replace(/\s+/g, ' ');
  if (/^[a-z\s]+$/i.test(normalizedLatinName)) {
    const [surname = '', ...givenNames] = normalizedLatinName.split(' ');
    const givenName = givenNames.join(' ');
    return surname && givenName ? `${surname.toUpperCase()}/${givenName.toUpperCase()}` : surname.toUpperCase();
  }

  return '--';
};

const buildIssueDate = (order: Order) => formatChineseDate(order.createdAt, '--');

const buildTicketPriceSummary = (baseFare: number, tax: number) => {
  const total = baseFare + tax;
  return `票价：${formatCurrency(baseFare)}，税费：${formatCurrency(tax)}，总计：${formatCurrency(total)}。`;
};

const buildRoutePrice = (
  order: Order,
  departureAirport: (typeof DEPARTURE_AIRPORTS)[number],
  arrivalAirport: (typeof ARRIVAL_AIRPORTS)[number],
) => {
  const countryBaseFare = BASE_FARE_BY_COUNTRY[arrivalAirport.country] || 4200;
  const routeSeed = hashText(`${order.orderId}|${departureAirport.code}|${arrivalAirport.code}|price`);
  const baseFare = countryBaseFare + seededInt(routeSeed, 0, 8) * 60;
  const taxRate = seededInt(nextSeed(routeSeed), 18, 28) / 100;
  const tax = Math.round((baseFare * taxRate) / 10) * 10;

  return {
    baseFare,
    tax,
  };
};

const buildFlightRow = (order: Order) => {
  const orderDate = parseOrderDate(order.createdAt) || new Date();
  const airline = seededItem(AIRLINES, getSeed(order, 'airline'));
  const flightDate = addDays(orderDate, seededInt(getSeed(order, 'flight-date'), 15, 30));
  const departureAirport = selectDepartureAirport(order);
  const arrivalAirport = selectArrivalAirport(order, getSeed(order, 'arrival'));
  const routePrice = buildRoutePrice(order, departureAirport, arrivalAirport);
  const departureTime = addMinutes(flightDate, seededInt(getSeed(order, 'departure-time'), 480, 720));
  const arrivalTime = addMinutes(departureTime, seededInt(getSeed(order, 'duration'), 360, 660));
  const flightDateDisplay = formatChineseDateFromDate(flightDate);
  const flightNo = `${airline.code}${buildSeededDigits(getSeed(order, 'flight-no'), 4)}`;

  return {
    airline: airline.name,
    airlineOrderNumber: `${airline.ticketPrefix}${buildSeededDigits(getSeed(order, 'airline-order-no'), 10)}`,
    arrivalDetail: `${arrivalAirport.code}-${arrivalAirport.city}\n${formatChineseDateFromDate(arrivalTime)} ${formatClock(arrivalTime)}\n${arrivalAirport.terminal}\n${arrivalAirport.airport}（${arrivalAirport.country}）`,
    date: flightDateDisplay,
    departureDetail: `${departureAirport.code}-${departureAirport.city}\n${flightDateDisplay} ${formatClock(departureTime)}\n${departureAirport.terminal}\n${departureAirport.airport}`,
    flightNo,
    paymentSummary: buildTicketPriceSummary(routePrice.baseFare, routePrice.tax),
    pnr: `${airline.code}${buildSeededAlphaNumeric(getSeed(order, 'pnr'), 4)}`,
    serviceClass: '经济舱',
    status: '准点',
  };
};

const buildEditablePreviewHtml = (order: Order) => {
  const flightRow = buildFlightRow(order);
  const issueDate = buildIssueDate(order);
  const passengerName = buildPassengerName(order);
  const exportTitle = `${getDisplayValue(order.customerName || order.licenseName, order.orderId)} 行程单`;
  const noticesHtml = DEFAULT_NOTICES.map((notice) => `<li>${escapeHtml(notice)}</li>`).join('');

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(exportTitle)}</title>
    <style>
      html, body {
        margin: 0;
        min-height: 100%;
        background: #eef2f7;
        color: #111827;
        font-family: "SimSun", "Songti SC", "Times New Roman", serif;
      }

      body {
        padding: 28px;
        box-sizing: border-box;
      }

      .docx-page {
        width: 1030px;
        max-width: 100%;
        min-height: 1268px;
        margin: 0 auto;
        padding: 52px 22px 44px;
        box-sizing: border-box;
        background: #ffffff;
        border: 1px solid #111111;
        box-shadow: 0 24px 60px rgba(15, 23, 42, 0.14);
      }

      .docx-page:focus {
        outline: 2px solid #2563eb;
        outline-offset: 6px;
      }

      .itinerary-document {
        font-size: 16px;
        line-height: 1.45;
      }

      .itinerary-document,
      .itinerary-document * {
        box-sizing: border-box;
      }

      .itinerary-title {
        margin: 0 0 38px;
        text-align: center;
        font-size: 34px;
        line-height: 1.2;
        font-weight: 500;
        letter-spacing: 0;
      }

      .itinerary-section {
        margin: 0 0 52px;
      }

      .itinerary-section--flight {
        margin-bottom: 45px;
      }

      .itinerary-section--payment {
        margin-bottom: 47px;
      }

      .itinerary-section__header {
        display: grid;
        grid-template-columns: 166px minmax(0, 1fr);
        align-items: center;
        gap: 8px;
        width: 100%;
        margin-bottom: 30px;
      }

      .itinerary-section__label {
        display: inline-flex;
        align-items: center;
        min-height: 27px;
        padding: 0 8px;
        box-sizing: border-box;
        background: #bfbfbf;
        color: #ffffff;
        font-size: 22px;
        line-height: 1;
        font-weight: 700;
      }

      .itinerary-section__line {
        height: 1px;
        background: #111111;
      }

      .itinerary-booking {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 420px;
        gap: 42px;
        padding: 8px 4px 0;
        font-size: 16px;
      }

      .itinerary-booking__left,
      .itinerary-booking__right {
        display: grid;
        gap: 9px;
      }

      table {
        width: 100%;
        border-collapse: collapse;
      }

      .itinerary-flight-table {
        width: calc(100% - 48px);
        max-width: 936px;
        margin: 0 auto;
        table-layout: fixed;
        color: #000000;
        font-size: 16px;
      }

      .itinerary-flight-table th,
      .itinerary-flight-table td {
        border: 1px solid #111111;
        vertical-align: middle;
        text-align: center;
        font-weight: 400;
        overflow-wrap: break-word;
      }

      .itinerary-flight-table th {
        height: 98px;
        padding: 0 8px;
        line-height: 1.45;
      }

      .itinerary-flight-table td {
        height: 188px;
        padding: 0 8px;
        line-height: 1.45;
      }

      .itinerary-flight-table__date {
        width: 18.7%;
      }

      .itinerary-flight-table__pnr {
        width: 10%;
      }

      .itinerary-flight-table__flight {
        width: 9.3%;
      }

      .itinerary-flight-table__departure {
        width: 21.8%;
      }

      .itinerary-flight-table__arrival {
        width: 22%;
      }

      .itinerary-flight-table__class {
        width: 8.8%;
      }

      .itinerary-flight-table__status {
        width: 9.4%;
      }

      .itinerary-flight-table__cell-text {
        white-space: pre-line;
      }

      .itinerary-payment {
        padding: 0 4px;
        font-size: 16px;
        line-height: 1.7;
      }

      .itinerary-notices {
        margin: 0;
        padding-left: 18px;
        font-size: 15px;
        line-height: 1.55;
      }

      .itinerary-notices li {
        margin-bottom: 3px;
      }

      @media (max-width: 1200px) {
        body {
          padding: 12px;
        }

        .docx-page {
          padding: 36px 18px;
          box-shadow: none;
        }
      }
    </style>
  </head>
  <body>
    <div class="docx-page itinerary-document">
      <h1 class="itinerary-title">行程单</h1>

      <section class="itinerary-section">
        <div class="itinerary-section__header">
          <div class="itinerary-section__label">预订详情</div>
          <div class="itinerary-section__line"></div>
        </div>
        <div class="itinerary-booking">
          <div class="itinerary-booking__left">
            <div>订单编号： ${escapeHtml(flightRow.airlineOrderNumber)}</div>
            <div>乘客： ${escapeHtml(passengerName)}</div>
            <div>发行航空公司： ${escapeHtml(flightRow.airline)}</div>
          </div>
          <div class="itinerary-booking__right">
            <div></div>
            <div>发行日期： ${escapeHtml(issueDate)}</div>
          </div>
        </div>
      </section>

      <section class="itinerary-section itinerary-section--flight">
        <div class="itinerary-section__header">
          <div class="itinerary-section__label">飞行详情</div>
          <div class="itinerary-section__line"></div>
        </div>
        <table class="itinerary-flight-table" aria-label="飞行详情">
          <colgroup>
            <col class="itinerary-flight-table__date" />
            <col class="itinerary-flight-table__pnr" />
            <col class="itinerary-flight-table__flight" />
            <col class="itinerary-flight-table__departure" />
            <col class="itinerary-flight-table__arrival" />
            <col class="itinerary-flight-table__class" />
            <col class="itinerary-flight-table__status" />
          </colgroup>
          <thead>
            <tr>
              <th class="itinerary-flight-table__date">日期</th>
              <th class="itinerary-flight-table__pnr">航空公司<br />PNR</th>
              <th class="itinerary-flight-table__flight">航班</th>
              <th class="itinerary-flight-table__departure">出发<br />时间<br />航站楼</th>
              <th class="itinerary-flight-table__arrival">到达<br />时间<br />航站楼</th>
              <th class="itinerary-flight-table__class">舱位</th>
              <th class="itinerary-flight-table__status">航班状态</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${escapeHtml(flightRow.date)}</td>
              <td>${escapeHtml(flightRow.pnr)}</td>
              <td>${escapeHtml(flightRow.flightNo)}</td>
              <td><div class="itinerary-flight-table__cell-text">${escapeHtml(flightRow.departureDetail)}</div></td>
              <td><div class="itinerary-flight-table__cell-text">${escapeHtml(flightRow.arrivalDetail)}</div></td>
              <td>${escapeHtml(flightRow.serviceClass)}</td>
              <td>${escapeHtml(flightRow.status)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="itinerary-section itinerary-section--payment">
        <div class="itinerary-section__header">
          <div class="itinerary-section__label">付款详情</div>
          <div class="itinerary-section__line"></div>
        </div>
        <div class="itinerary-payment">${escapeHtml(flightRow.paymentSummary)}</div>
      </section>

      <section class="itinerary-section">
        <div class="itinerary-section__header">
          <div class="itinerary-section__label">通知</div>
          <div class="itinerary-section__line"></div>
        </div>
        <ol class="itinerary-notices">${noticesHtml}</ol>
      </section>
    </div>
  </body>
</html>`;
};

const PDF_EXPORT_STYLE_OVERRIDE = `
  html,
  body {
    margin: 0 !important;
    background: #ffffff !important;
  }

  .itinerary-export-pdf {
    box-shadow: none !important;
  }

  .itinerary-export-pdf,
  .itinerary-export-pdf * {
    box-sizing: border-box !important;
  }

  .itinerary-export-pdf .itinerary-flight-table {
    width: calc(100% - 48px) !important;
    max-width: 936px !important;
    table-layout: fixed !important;
  }
`;

const openPrintablePdfFallback = (html: string, title: string) => {
  const printFrame = document.createElement('iframe');

  printFrame.style.position = 'fixed';
  printFrame.style.right = '0';
  printFrame.style.bottom = '0';
  printFrame.style.width = '0';
  printFrame.style.height = '0';
  printFrame.style.border = '0';
  printFrame.setAttribute('aria-hidden', 'true');
  document.body.appendChild(printFrame);

  const printDocument = printFrame.contentDocument;
  const printWindow = printFrame.contentWindow;

  if (!printDocument || !printWindow) {
    printFrame.remove();
    throw new Error('Failed to create printable PDF frame');
  }

  printDocument.open();
  printDocument.write(`
    <!doctype html>
    <html lang="zh-CN">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title)}</title>
        <style>
          @page {
            margin: 0;
          }

          html,
          body {
            margin: 0;
            background: #ffffff;
          }

          body {
            padding: 0;
          }
        </style>
      </head>
      <body>${html}</body>
    </html>
  `);
  printDocument.close();

  window.setTimeout(() => {
    printWindow.focus();
    printWindow.print();
    window.setTimeout(() => {
      printFrame.remove();
    }, 1000);
  }, 300);
};

const NotaryItineraryExport: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id = '' } = useParams();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const order = useMemo(() => getOrderById(id) ?? null, [id]);
  const backPath =
    typeof (location.state as { from?: unknown } | null)?.from === 'string'
      ? ((location.state as { from: string }).from || '/order-management/notary-orders')
      : '/order-management/notary-orders';

  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>('loading');
  const [previewHtml, setPreviewHtml] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const baseFileName = useMemo(() => {
    const name = sanitizeFilenamePart(order?.licenseName || order?.customerName || order?.orderId || '未命名');
    return `${name || '未命名'}行程单`;
  }, [order?.customerName, order?.licenseName, order?.orderId]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (!order) {
      setPreviewStatus('error');
      setPreviewHtml('');
      return;
    }

    setPreviewStatus('loading');
    setPreviewHtml(buildEditablePreviewHtml(order));
    setPreviewStatus('ready');
  }, [order]);

  const enableEditablePreview = useCallback(() => {
    const currentDocument = iframeRef.current?.contentDocument;
    const previewPage = currentDocument?.querySelector<HTMLElement>('.docx-page');

    if (!currentDocument || !previewPage) {
      return;
    }

    previewPage.contentEditable = 'true';
    previewPage.spellcheck = false;
    previewPage.setAttribute('aria-label', '可编辑 Word 行程单内容');
    previewPage.style.outline = '2px solid #2563eb';
    previewPage.style.outlineOffset = '6px';
    currentDocument.body.dataset.editing = 'true';
  }, []);

  const handlePreviewLoad = () => {
    if (isEditing) {
      enableEditablePreview();
    }
  };

  useEffect(() => {
    if (!isEditing) {
      return;
    }

    const frameId = window.requestAnimationFrame(enableEditablePreview);
    return () => window.cancelAnimationFrame(frameId);
  }, [enableEditablePreview, isEditing]);

  const getCurrentPreviewHtml = useCallback(() => {
    const currentDocument = iframeRef.current?.contentDocument;
    if (!currentDocument) {
      return previewHtml;
    }

    const documentClone = currentDocument.documentElement.cloneNode(true) as HTMLElement;
    const previewPage = documentClone.querySelector<HTMLElement>('.docx-page');

    if (previewPage) {
      previewPage.contentEditable = 'false';
      previewPage.removeAttribute('aria-label');
      previewPage.removeAttribute('spellcheck');
      previewPage.style.outline = '';
      previewPage.style.outlineOffset = '';
    }

    return `<!doctype html>\n${documentClone.outerHTML}`;
  }, [previewHtml]);

  const saveEditedPreview = useCallback(() => {
    const currentHtml = getCurrentPreviewHtml();
    if (currentHtml) {
      setPreviewHtml(currentHtml);
    }
    setIsEditing(false);
  }, [getCurrentPreviewHtml]);

  const handleToggleEditing = () => {
    if (previewStatus !== 'ready') return;
    if (isEditing) {
      saveEditedPreview();
      return;
    }
    setIsEditing(true);
  };

  const getCurrentPreviewPage = useCallback(() => {
    const currentDocument = iframeRef.current?.contentDocument;
    const previewPage = currentDocument?.querySelector<HTMLElement>('.docx-page');

    if (!currentDocument || !previewPage) {
      return null;
    }

    const styles = Array.from(currentDocument.head.querySelectorAll('style'))
      .map((styleElement) => styleElement.textContent || '')
      .join('\n');
    const rect = previewPage.getBoundingClientRect();
    const width = Math.max(1, Math.ceil(rect.width || previewPage.scrollWidth || previewPage.offsetWidth || 0));
    const height = Math.max(1, Math.ceil(rect.height || previewPage.scrollHeight || previewPage.offsetHeight || 0));
    const pageClone = previewPage.cloneNode(true) as HTMLElement;
    pageClone.contentEditable = 'false';
    pageClone.classList.add('itinerary-export-pdf');
    pageClone.removeAttribute('aria-label');
    pageClone.removeAttribute('spellcheck');
    pageClone.style.outline = '';
    pageClone.style.outlineOffset = '';

    return {
      height,
      html: `<style>${styles}\n${PDF_EXPORT_STYLE_OVERRIDE}</style>${serializeElementAsXhtml(pageClone)}`,
      width,
    };
  }, []);

  const renderHtmlToImageBlob = useCallback(async (html: string, width: number, height: number) => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <foreignObject width="100%" height="100%">
          <div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;">${html}</div>
        </foreignObject>
      </svg>
    `.trim();

    const image = new Image();
    const loaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Failed to render itinerary preview as image'));
    });

    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    await loaded;

    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to create canvas for itinerary export');
    }

    context.scale(scale, scale);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to encode itinerary export image'));
            return;
          }

          resolve(blob);
        },
        'image/jpeg',
        0.95,
      );
    });
  }, []);

  const handleExportPdf = async () => {
    const previewPage = getCurrentPreviewPage();
    if (!previewPage) {
      window.alert('无法读取当前预览内容，请先重新加载文档。');
      return;
    }

    try {
      const imageBlob = await renderHtmlToImageBlob(previewPage.html, previewPage.width, previewPage.height);
      await exportNotaryImageBlobsToPdf([{ blob: imageBlob }], `${baseFileName}.pdf`);
    } catch (error) {
      console.error('Failed to export notary itinerary PDF', error);
      try {
        openPrintablePdfFallback(previewPage.html, `${baseFileName}.pdf`);
      } catch (fallbackError) {
        console.error('Failed to open itinerary PDF print fallback', fallbackError);
        window.alert('PDF 导出失败，请稍后重试。');
      }
    }
  };

  const renderContent = () => {
    if (previewStatus === 'loading') {
      return (
        <div className="license-translation-docx-state" aria-live="polite">
          <div className="license-translation-docx-state__icon">PDF</div>
          <strong>正在加载行程单模板</strong>
          <span>请稍候，系统正在生成可编辑文档。</span>
        </div>
      );
    }

    if (previewStatus === 'error' || !order) {
      return (
        <div className="license-translation-docx-state" aria-live="polite">
          <div className="license-translation-docx-state__icon">ERR</div>
          <strong>行程单加载失败</strong>
          <span>未找到订单或模板资源，请返回上一页重试。</span>
        </div>
      );
    }

    return (
      <iframe
        ref={iframeRef}
        title={`${baseFileName} 预览`}
        className="license-translation-docx-frame"
        srcDoc={previewHtml}
        onLoad={handlePreviewLoad}
      />
    );
  };

  return (
    <main className="license-translation-export-modal license-translation-export-page notary-itinerary-export-page" aria-label="导出行程单页面">
      <header className="license-translation-export-modal__header">
        <div>
          <strong>导出行程单</strong>
          <span>{order?.orderId || '未找到订单'}</span>
        </div>
      </header>

      <div className="license-translation-export-modal__body license-translation-docx-viewer">
        {renderContent()}
      </div>

      <footer className="license-translation-export-modal__footer">
        <div className="license-translation-export-modal__actions">
          <button
            type="button"
            className={`license-translation-button ${
              isEditing ? 'license-translation-button--primary' : 'license-translation-button--secondary'
            }`}
            disabled={previewStatus !== 'ready'}
            onClick={handleToggleEditing}
          >
            {isEditing ? '保存修改' : '修改信息'}
          </button>
          <button
            type="button"
            className="license-translation-button license-translation-button--primary"
            disabled={previewStatus !== 'ready'}
            onClick={() => void handleExportPdf()}
          >
            导出PDF
          </button>
          <button
            type="button"
            className="license-translation-button license-translation-export-modal__back-button"
            onClick={() => navigate(backPath)}
          >
            返回
          </button>
        </div>
      </footer>
    </main>
  );
};

export default NotaryItineraryExport;
