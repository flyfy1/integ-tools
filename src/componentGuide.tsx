import { useEffect, useState } from 'react';
import type { Locale } from './i18n';
import { bandColors, bandTolerances, colorHex, decodeBands, formatComponentValue, type BandColor, type ComponentType } from './componentBands';
import './componentGuide.css';

const examples: { type: ComponentType; colors: BandColor[]; name: [string, string]; equation: string; roles: [string[], string[]] }[] = [
  { type: 'resistor', colors: ['brown', 'black', 'red', 'gold'], name: ['4 环电阻 · 1 kΩ', '4-band resistor · 1 kΩ'], equation: '10 × 100 Ω = 1,000 Ω = 1 kΩ', roles: [['第 1 位：1', '第 2 位：0', '倍率：×100', '容差：±5%'], ['Digit 1: 1', 'Digit 2: 0', 'Multiply: ×100', 'Tolerance: ±5%']] },
  { type: 'resistor', colors: ['red', 'orange', 'violet', 'black', 'brown'], name: ['5 环电阻 · 237 Ω', '5-band resistor · 237 Ω'], equation: '237 × 1 Ω = 237 Ω', roles: [['第 1 位：2', '第 2 位：3', '第 3 位：7', '倍率：×1', '容差：±1%'], ['Digit 1: 2', 'Digit 2: 3', 'Digit 3: 7', 'Multiply: ×1', 'Tolerance: ±1%']] },
  { type: 'inductor', colors: ['red', 'violet', 'brown', 'gold'], name: ['EIA 电感 · 270 µH', 'EIA inductor · 270 µH'], equation: '27 × 10 µH = 270 µH = 0.27 mH', roles: [['第 1 位：2', '第 2 位：7', '倍率：×10', '容差：±5%'], ['Digit 1: 2', 'Digit 2: 7', 'Multiply: ×10', 'Tolerance: ±5%']] },
  { type: 'inductor', colors: ['blue', 'grey', 'gold', 'silver'], name: ['EIA 电感 · 6.8 µH', 'EIA inductor · 6.8 µH'], equation: '68 × 0.1 µH = 6.8 µH', roles: [['第 1 位：6', '第 2 位：8', '倍率：×0.1', '容差：±10%'], ['Digit 1: 6', 'Digit 2: 8', 'Multiply: ×0.1', 'Tolerance: ±10%']] },
  { type: 'inductor-mil', colors: ['silver', 'blue', 'gold', 'grey', 'silver'], name: ['MIL 电感 · 6.8 µH', 'MIL inductor · 6.8 µH'], equation: '6 . 8 µH = 6.8 µH', roles: [['宽银环：标识', '数字：6', '金环：小数点', '数字：8', '容差：±10%'], ['Wide silver: ID', 'Digit: 6', 'Gold: decimal', 'Digit: 8', 'Tolerance: ±10%']] },
];
const colorNames = {
  zh: ['黑', '棕', '红', '橙', '黄', '绿', '蓝', '紫', '灰', '白', '金', '银'],
  en: ['Black', 'Brown', 'Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Violet', 'Grey', 'White', 'Gold', 'Silver'],
};

export function ComponentGuide({ locale, onExample }: { locale: Locale; onExample: (type: ComponentType, colors: BandColor[]) => void }) {
  const zh = locale === 'zh', lang = zh ? 0 : 1;
  const names = colorNames[zh ? 'zh' : 'en'];
  const [selected, setSelected] = useState(0);
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (['component-guide', 'guide-units', 'guide-bands', 'guide-examples', 'guide-measure'].includes(id)) document.getElementById(id)?.scrollIntoView({ block: 'start' });
  }, []);
  const example = examples[selected], reading = decodeBands(example.colors, example.type)[0];
  const label = (color: BandColor) => names[bandColors.indexOf(color)];
  return <section id="component-guide" className="component-guide" aria-labelledby="component-guide-title">
    <p className="eyebrow">{zh ? '色环入门与实际测量' : 'COLOR CODES & MEASUREMENT'}</p>
    <h2 id="component-guide-title">{zh ? '色环怎么读？数值怎么量？' : 'How do you read bands and measure values?'}</h2>
    <nav aria-label={zh ? '说明目录' : 'Guide contents'}>{[['guide-units', zh ? '单位与容差' : 'Units & tolerance'], ['guide-bands', zh ? '色环读法' : 'Reading bands'], ['guide-examples', zh ? '逐环示例' : 'Examples'], ['guide-measure', zh ? '仪表测量' : 'Measurement']].map(([id, title]) => <a href={`#${id}`} key={id}>{title}</a>)}</nav>

    <section id="guide-units">
      <h3>{zh ? '1. 先分清：电阻的阻值，电感的电感量' : '1. Resistance and inductance use different units'}</h3>
      <div className="guide-cards">
        <article><h4>{zh ? '电阻 R · 欧姆 Ω' : 'Resistance R · ohms Ω'}</h4><p>{zh ? '电阻表示对电流的阻碍程度。数值常写成 Ω、kΩ、MΩ。' : 'Resistance describes opposition to current. Values are commonly written in Ω, kΩ or MΩ.'}</p><p className="guide-formula">1 kΩ = 1,000 Ω<br/>1 MΩ = 1,000 kΩ</p></article>
        <article><h4>{zh ? '电感 L · 亨利 H' : 'Inductance L · henries H'}</h4><p>{zh ? '电感表示线圈对电流变化的响应，常见小元件用 µH 或 mH 标示。' : 'Inductance describes a coil’s response to changing current. Small components commonly use µH or mH.'}</p><p className="guide-formula">1 mH = 1,000 µH<br/>1 H = 1,000 mH</p></article>
      </div>
      <p>{zh ? '色环给出标称值及容差，摄像头是在读取标记。比如 1 kΩ ±5%，表示标称 1,000 Ω，允许范围是 950–1,050 Ω；实测值还受温度和测量条件影响。' : 'Bands encode a nominal value and tolerance; the camera reads that marking. For 1 kΩ ±5%, the nominal value is 1,000 Ω and the tolerance range is 950–1,050 Ω. Temperature and measurement conditions also affect the actual reading.'}</p>
    </section>

    <section id="guide-bands">
      <h3>{zh ? '2. 先判断读向，再数色环' : '2. Find the reading direction, then count bands'}</h3>
      <p>{zh ? '常见 4 环电阻的金 / 银容差环放在最后，往往与其他环隔得更远，从另一端开始读。5 环电阻的容差环也可能是棕色等颜色；间距只是线索，不能只凭主体颜色或“哪端看着像开头”判断。若正反都能解码，请查元件资料或用仪表确认。' : 'On common 4-band resistors, the gold or silver tolerance band is last and often has a larger gap. Read from the opposite end. A 5-band resistor can have a brown or other tolerance color. Spacing is a clue, not proof; if both directions decode, check the part documentation or measure it.'}</p>
      <p className="guide-small">{zh ? '工具会先检查两端颜色是否符合数字、倍率和容差编码；末端金 / 银环不能作为开头的数字环。摄像头还会比较色环边缘之间的间距，将明显隔开的末端环作为容差环候选，优先显示对应读向并说明原因，另一有效读向可展开查看。间距相近时保留两个候选，间距与编码冲突时提示核对。手动输入颜色没有实际间距信息；读向优先也不代表已确认容差环的颜色。' : 'The reader checks both directions against digit, multiplier and tolerance rules; gold/silver end bands cannot be leading digits. Camera scans also compare gaps between band edges. A distinctly separated end band favors that end as tolerance, with an explanation and an expandable alternative. Similar gaps keep both candidates; conflicting spacing and colors prompt verification. Manual colors alone have no spacing evidence, and a preferred direction does not confirm the tolerance color.'}</p>
      <div className="guide-table-wrap"><table><caption>{zh ? '本工具支持的色环排列' : 'Band layouts supported by this reader'}</caption><thead><tr><th>{zh ? '元件' : 'Component'}</th><th>{zh ? '从读入端到末端' : 'From first to last band'}</th><th>{zh ? '计算方法' : 'Calculation'}</th></tr></thead><tbody>
        <tr><th>{zh ? '4 环电阻' : '4-band resistor'}</th><td>{zh ? '数字 · 数字 · 倍率 · 容差' : 'Digit · digit · multiplier · tolerance'}</td><td>AB × {zh ? '倍率' : 'multiplier'} Ω</td></tr>
        <tr><th>{zh ? '5 环电阻' : '5-band resistor'}</th><td>{zh ? '数字 · 数字 · 数字 · 倍率 · 容差' : 'Digit · digit · digit · multiplier · tolerance'}</td><td>ABC × {zh ? '倍率' : 'multiplier'} Ω</td></tr>
        <tr><th>{zh ? '4 环 EIA 电感' : '4-band EIA inductor'}</th><td>{zh ? '数字 · 数字 · 倍率 · 容差' : 'Digit · digit · multiplier · tolerance'}</td><td>AB × {zh ? '倍率' : 'multiplier'} µH</td></tr>
        <tr><th>{zh ? '5 环 MIL 电感' : '5-band MIL inductor'}</th><td>{zh ? '宽银标识 · 数字 · 数字 · 倍率 · 容差' : 'Wide silver ID · digit · digit · multiplier · tolerance'}</td><td>{zh ? '≥10 µH 时按 AB × 倍率' : 'AB × multiplier for ≥10 µH'}</td></tr>
      </tbody></table></div>
      <p>{zh ? 'AB / ABC 是把数字拼起来，不是相乘：棕、黑得到 10。MIL 电感首端的宽银环约为其他环的两倍宽，是标识环；小于 10 µH 时，随后的三环中金色位于第 1 或第 2 位，表示小数点。例如宽银 / 蓝 / 金 / 灰 / 银是 6.8 µH ±10%。不要按 5 环电阻来读。' : 'AB / ABC means joining digits, not multiplying them: brown + black gives 10. A MIL inductor starts with a silver identifier about twice the other bands’ width. Below 10 µH, gold in the first or second position of the next three bands marks a decimal point. Wide silver / blue / gold / grey / silver means 6.8 µH ±10%.'}</p>
      <div className="guide-table-wrap"><table className="guide-color-table"><caption>{zh ? '电阻 / EIA 电感色环表（本工具采用的编码）' : 'Resistor / EIA color table used by this reader'}</caption><thead><tr><th>{zh ? '颜色' : 'Color'}</th><th>{zh ? '数字' : 'Digit'}</th><th>{zh ? '倍率' : 'Multiplier'}</th><th>{zh ? '电阻容差' : 'Resistor tolerance'}</th></tr></thead><tbody>{bandColors.map((color, index) => <tr key={color}><th><span className="guide-color-chip" style={{ backgroundColor: colorHex[color] }} aria-hidden="true"/>{label(color)}</th><td>{index < 10 ? index : '—'}</td><td>×{index === 10 ? '0.1' : index === 11 ? '0.01' : (10 ** index).toLocaleString('en-US')}</td><td>{bandTolerances[color] === undefined ? '—' : `±${bandTolerances[color]}%`}</td></tr>)}</tbody></table></div>
      <p className="guide-small">{zh ? '“—”表示本表不采用该位置的编码。金 / 银不能作为普通数字环，作为倍率分别是 ×0.1 / ×0.01；作为容差是 ±5% / ±10%。本工具的 EIA / MIL 电感容差支持金、银两种，MIL 小数点读法单独见上文。6 环电阻通常另有温度系数环，当前扫描器不支持。' : '“—” means no code is used here. Gold/silver are not ordinary digit bands: their multipliers are ×0.1/×0.01 and tolerances ±5%/±10%. This reader supports gold/silver tolerances for EIA/MIL inductors; MIL decimals follow the separate rule above. A 6-band resistor commonly adds a temperature-coefficient band and is not supported by this scanner.'}</p>
    </section>

    <section id="guide-examples">
      <h3>{zh ? '3. 对照例子，逐环阅读' : '3. Read examples one band at a time'}</h3>
      <label className="guide-example-select">{zh ? '选择例子' : 'Choose an example'}<select value={selected} onChange={e => setSelected(Number(e.target.value))}>{examples.map((item, index) => <option key={index} value={index}>{item.name[lang]}</option>)}</select></label>
      <p className="guide-read-direction">{zh ? '读向：从左到右 →（图示，不是摄像头识别结果）' : 'Read left to right → (illustration, not a camera result)'}</p>
      <div className="guide-part" role="img" aria-label={`${example.name[lang]}: ${example.colors.map(label).join(' / ')}`} dir="ltr"><div className="guide-part-body">{example.colors.map((color, i) => <span key={i} style={{ left: `${(example.type === 'inductor-mil' ? [12, 32, 50, 68, 86] : example.colors.length === 5 ? [12, 28, 44, 60, 84] : [12, 32, 52, 84])[i]}%`, backgroundColor: colorHex[color], width: example.type === 'inductor-mil' && i === 0 ? '10%' : '5%' }}><b>{i + 1}</b></span>)}</div></div>
      <ol className="guide-example-roles">{example.colors.map((color, i) => <li key={i}><span className="guide-color-chip" style={{ backgroundColor: colorHex[color] }} aria-hidden="true"/><b>{label(color)}</b><span>{example.roles[lang][i]}</span></li>)}</ol>
      <div className="guide-example-result"><p>{example.equation}</p><strong>{formatComponentValue(reading.value, example.type)} ±{reading.tolerance}%</strong></div>
      <button onClick={() => { onExample(example.type, example.colors); document.getElementById('component-scanner')?.scrollIntoView({ block: 'start' }); }}>{zh ? '把这个例子填入上方工具' : 'Load this example into the reader'}</button>
    </section>

    <section id="guide-measure">
      <h3>{zh ? '4. 用仪表确认实际数值' : '4. Confirm the actual value with an instrument'}</h3>
      <div className="guide-cards">
        <article><h4>{zh ? '电阻：万用表 Ω 档' : 'Resistor: multimeter Ω mode'}</h4><ol><li>{zh ? '断开电源，确认无电压，并按设备说明安全释放电容残余电荷。' : 'Disconnect power, verify no voltage, and safely discharge stored capacitor energy according to the equipment instructions.'}</li><li>{zh ? '黑表笔接 COM，红表笔接 V/Ω 插孔，选择 Ω 档或合适量程。' : 'Connect black to COM, red to V/Ω, then select Ω mode and a suitable range.'}</li><li>{zh ? '两表笔分别接电阻两端，稳定后读数；留意 Ω、kΩ、MΩ 的单位。' : 'Touch the probes to opposite resistor leads, wait for a stable value, and check the displayed unit.'}</li><li>{zh ? '板上并联通路可能让读数偏低。需要准确值时，将元件取下或脱开一端再量；很小的阻值还要考虑表笔电阻。' : 'Parallel paths on a board can lower the reading. Remove the part or disconnect one lead for an accurate reading; very low values also include probe resistance.'}</li></ol></article>
        <article><h4>{zh ? '电感：LCR 表 / 电感测量档' : 'Inductor: LCR meter / inductance mode'}</h4><ol><li>{zh ? '断电并隔离元件，避免其他电路影响测量。' : 'Disconnect power and isolate the component from the circuit.'}</li><li>{zh ? '选择电感 L 测量功能，按仪表说明做开路 / 短路补偿，再连接电感两端。' : 'Select inductance L, perform the instrument’s open/short correction, and connect both inductor leads.'}</li><li>{zh ? '按元件资料选择测试频率与信号条件。电感量会随频率、测试电流及磁芯状态变化，比较时应使用相同条件。' : 'Use the frequency and signal conditions specified for the part. Inductance can vary with frequency, test current and core state; compare under matching conditions.'}</li></ol><p><b>{zh ? 'Ω 档测到的是线圈的直流电阻（DCR），不是电感量。读到几 Ω 或接近 0 Ω，并不能说明它有多少 µH。' : 'Ω mode measures the winding’s DC resistance (DCR), not inductance. A few ohms or near-zero resistance does not tell you its value in µH.'}</b></p></article>
      </div>
      <p>{zh ? '色环磨损、元件烧焦、贴片文字或特殊厂商编码时，先查型号 / 数据表，再用合适仪表确认；相似外形不能可靠区分电阻和电感。摄像头读错时，可用上方 Debug 上传清晰照片和预期值。' : 'For worn bands, damaged parts, SMD text or manufacturer-specific codes, identify the part and check its datasheet before measuring. Similar appearances do not reliably distinguish resistors from inductors. Use Debug above to report a misread photo and expected value.'}</p>
    </section>
    <p className="guide-sources">{zh ? '参考资料：' : 'References: '}<a href="https://www.vishay.com/docs/49411/resistor_color_code_calculator.pdf" target="_blank" rel="noreferrer">Vishay</a> · <a href="https://www.bourns.com/docs/technical-documents/technical-library/inductive-components/publications/ColorCodeMarkings.pdf" target="_blank" rel="noreferrer">Bourns</a> · <a href="https://www.fluke.com/en-us/learn/blog/digital-multimeters/how-to-measure-resistance" target="_blank" rel="noreferrer">Fluke</a> · <a href="https://helpfiles.keysight.com/BenchVueSoftware_HDML5HelpFiles/LCRApp/English/Content/GUI/Instrument%20Settings/Measurement%20Tab.htm" target="_blank" rel="noreferrer">Keysight</a></p>
  </section>;
}
