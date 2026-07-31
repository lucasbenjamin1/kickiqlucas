import { useState } from 'react';

const HASHES = ['LH', 'LM', 'M', 'RM', 'RH'];
const RESULTS = ['Made', 'Missed', 'Blocked'];
const ROTATIONS = ['Good', 'Okay', 'Bad'];

export default function PrintSheet() {
  const [teamName, setTeamName] = useState('');
  const [athleteName, setAthleteName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [sessionType, setSessionType] = useState('Practice');
  const [weather, setWeather] = useState('');
  const [wind, setWind] = useState('');
  const [surface, setSurface] = useState('');
  const [coachName, setCoachName] = useState('');
  const [notes, setNotes] = useState('');

  const rows = Array.from({ length: 25 }, (_, i) => i + 1);

  return (
    <>
      {/* Screen-only: Print button and back link */}
      <div className="no-print fixed top-0 left-0 right-0 z-50 bg-gray-900 text-white px-4 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <a href="/" className="text-sm text-gray-300 hover:text-white underline">
            &larr; Home
          </a>
          <span className="text-sm text-gray-400">|</span>
          <span className="text-sm font-medium">Printable Tracking Sheet</span>
        </div>
        <button
          onClick={() => window.print()}
          className="bg-white text-gray-900 font-semibold px-5 py-2 rounded-lg text-sm
                     hover:bg-gray-100 active:bg-gray-200 transition-colors min-h-touch"
        >
          Print Sheet
        </button>
      </div>

      {/* Spacer for fixed bar on screen */}
      <div className="no-print h-14" />

      {/* The actual printable sheet */}
      <div className="print-sheet max-w-[11in] mx-auto p-4 print:p-0">
        {/* === HEADER === */}
        <div className="mb-3">
          {/* Title */}
          <div className="text-center mb-3">
            <h1 className="text-lg font-bold tracking-wide uppercase" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
              KickIQ Field Goal Tracking Sheet
            </h1>
          </div>

          {/* Editable header fields grid */}
          <div className="grid grid-cols-4 gap-x-3 gap-y-1.5 text-[10pt] print:text-[10pt]" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
            {/* Row 1 */}
            <div className="flex items-center gap-1">
              <span className="font-bold whitespace-nowrap">Team:</span>
              <input
                className="flex-1 border-b border-dotted border-black bg-transparent px-1 py-0.5 outline-none min-w-0"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder=" "
                style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '10pt' }}
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="font-bold whitespace-nowrap">Athlete:</span>
              <input
                className="flex-1 border-b border-dotted border-black bg-transparent px-1 py-0.5 outline-none min-w-0"
                value={athleteName}
                onChange={(e) => setAthleteName(e.target.value)}
                placeholder=" "
                style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '10pt' }}
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="font-bold whitespace-nowrap">Date:</span>
              <input
                type="date"
                className="flex-1 border-b border-dotted border-black bg-transparent px-1 py-0.5 outline-none min-w-0"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '10pt' }}
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="font-bold whitespace-nowrap">Type:</span>
              <select
                className="flex-1 border-b border-dotted border-black bg-transparent px-1 py-0.5 outline-none min-w-0"
                value={sessionType}
                onChange={(e) => setSessionType(e.target.value)}
                style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '10pt' }}
              >
                <option>Practice</option>
                <option>Game</option>
                <option>Pregame</option>
                <option>Scrimmage</option>
                <option>Tryout</option>
                <option>Camp</option>
                <option>Other</option>
              </select>
            </div>

            {/* Row 2 */}
            <div className="flex items-center gap-1">
              <span className="font-bold whitespace-nowrap">Weather:</span>
              <input
                className="flex-1 border-b border-dotted border-black bg-transparent px-1 py-0.5 outline-none min-w-0"
                value={weather}
                onChange={(e) => setWeather(e.target.value)}
                placeholder=" "
                style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '10pt' }}
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="font-bold whitespace-nowrap">Wind:</span>
              <input
                className="flex-1 border-b border-dotted border-black bg-transparent px-1 py-0.5 outline-none min-w-0"
                value={wind}
                onChange={(e) => setWind(e.target.value)}
                placeholder=" "
                style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '10pt' }}
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="font-bold whitespace-nowrap">Surface:</span>
              <input
                className="flex-1 border-b border-dotted border-black bg-transparent px-1 py-0.5 outline-none min-w-0"
                value={surface}
                onChange={(e) => setSurface(e.target.value)}
                placeholder=" "
                style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '10pt' }}
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="font-bold whitespace-nowrap">Coach:</span>
              <input
                className="flex-1 border-b border-dotted border-black bg-transparent px-1 py-0.5 outline-none min-w-0"
                value={coachName}
                onChange={(e) => setCoachName(e.target.value)}
                placeholder=" "
                style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '10pt' }}
              />
            </div>
          </div>

          {/* Notes row */}
          <div className="flex items-start gap-1 mt-1.5 text-[10pt]" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
            <span className="font-bold whitespace-nowrap">Notes:</span>
            <input
              className="flex-1 border-b border-dotted border-black bg-transparent px-1 py-0.5 outline-none"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder=" "
              style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '10pt' }}
            />
          </div>
        </div>

        {/* === KICK TABLE === */}
        <table
          className="w-full border-collapse mb-4 text-[9pt] print:text-[9pt]"
          style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
        >
          <thead>
            <tr>
              <th className="border border-black px-1 py-1 text-center font-bold bg-gray-100 print:bg-gray-200 w-8">
                #
              </th>
              <th className="border border-black px-1 py-1 text-center font-bold bg-gray-100 print:bg-gray-200 w-10">
                Dist
              </th>
              <th className="border border-black px-1 py-1 text-center font-bold bg-gray-100 print:bg-gray-200">
                Hash
              </th>
              <th className="border border-black px-1 py-1 text-center font-bold bg-gray-100 print:bg-gray-200">
                Result
              </th>
              <th className="border border-black px-1 py-1 text-center font-bold bg-gray-100 print:bg-gray-200 w-11">
                Op Time
              </th>
              <th className="border border-black px-1 py-1 text-center font-bold bg-gray-100 print:bg-gray-200 w-8">
                LZ
              </th>
              <th className="border border-black px-1 py-1 text-center font-bold bg-gray-100 print:bg-gray-200">
                Miss Dir
              </th>
              <th className="border border-black px-1 py-1 text-center font-bold bg-gray-100 print:bg-gray-200">
                Rotation
              </th>
              <th className="border border-black px-1 py-1 text-center font-bold bg-gray-100 print:bg-gray-200 w-9">
                Snap
              </th>
              <th className="border border-black px-1 py-1 text-center font-bold bg-gray-100 print:bg-gray-200 w-9">
                Hold
              </th>
              <th className="border border-black px-1 py-1 text-center font-bold bg-gray-100 print:bg-gray-200">
                Notes
              </th>
            </tr>
            {/* Sub-header with checkbox labels */}
            <tr className="text-[7pt] print:text-[7pt] leading-tight">
              <th className="border border-black px-1 text-center text-gray-500 font-normal"></th>
              <th className="border border-black px-1 text-center text-gray-500 font-normal">(yd)</th>
              <th className="border border-black px-0.5 text-center text-gray-500 font-normal">
                <span className="inline-flex gap-0.5 justify-center flex-wrap">
                  {HASHES.map((h) => (
                    <span key={h} className="whitespace-nowrap">{h}</span>
                  ))}
                </span>
              </th>
              <th className="border border-black px-0.5 text-center text-gray-500 font-normal">
                <span className="inline-flex gap-0.5 justify-center flex-wrap">
                  {RESULTS.map((r) => (
                    <span key={r} className="whitespace-nowrap">{r.slice(0, 1)}</span>
                  ))}
                </span>
              </th>
              <th className="border border-black px-1 text-center text-gray-500 font-normal">(s)</th>
              <th className="border border-black px-1 text-center text-gray-500 font-normal"></th>
              <th className="border border-black px-0.5 text-center text-gray-500 font-normal">
                <span className="inline-flex gap-0.5 justify-center flex-wrap">
                  <span>S</span><span>WL</span><span>WR</span><span>CB</span>
                </span>
              </th>
              <th className="border border-black px-0.5 text-center text-gray-500 font-normal">
                <span className="inline-flex gap-0.5 justify-center flex-wrap">
                  {ROTATIONS.map((r) => (
                    <span key={r} className="whitespace-nowrap">{r.slice(0, 1)}</span>
                  ))}
                </span>
              </th>
              <th className="border border-black px-1 text-center text-gray-500 font-normal">1-5</th>
              <th className="border border-black px-1 text-center text-gray-500 font-normal">1-5</th>
              <th className="border border-black px-1 text-center text-gray-500 font-normal"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((num) => (
              <tr key={num} className="h-5 print:h-5">
                <td className="border border-black px-1 text-center text-gray-600 font-mono text-[8pt] print:text-[8pt]">
                  {num}
                </td>
                <td className="border border-black px-1"></td>
                <td className="border border-black px-0.5">
                  <span className="flex gap-0.5 justify-center">
                    {HASHES.map((h) => (
                      <span key={h} className="inline-flex items-center gap-0.5 text-[7pt] print:text-[7pt]">
                        <span className="w-2.5 h-2.5 border border-black inline-block align-middle" />
                      </span>
                    ))}
                  </span>
                </td>
                <td className="border border-black px-0.5">
                  <span className="flex gap-0.5 justify-center">
                    {RESULTS.map((r) => (
                      <span key={r} className="inline-flex items-center gap-0.5 text-[7pt] print:text-[7pt]">
                        <span className="w-2.5 h-2.5 border border-black inline-block align-middle" />
                      </span>
                    ))}
                  </span>
                </td>
                <td className="border border-black px-1"></td>
                <td className="border border-black px-1"></td>
                <td className="border border-black px-0.5">
                  <span className="flex gap-0.5 justify-center">
                    {['S', 'WL', 'WR', 'CB'].map((l) => (
                      <span key={l} className="inline-flex items-center gap-0.5 text-[7pt] print:text-[7pt]">
                        <span className="w-2.5 h-2.5 border border-black inline-block align-middle" />
                      </span>
                    ))}
                  </span>
                </td>
                <td className="border border-black px-0.5">
                  <span className="flex gap-0.5 justify-center">
                    {ROTATIONS.map((r) => (
                      <span key={r} className="inline-flex items-center gap-0.5 text-[7pt] print:text-[7pt]">
                        <span className="w-2.5 h-2.5 border border-black inline-block align-middle" />
                      </span>
                    ))}
                  </span>
                </td>
                <td className="border border-black px-1"></td>
                <td className="border border-black px-1"></td>
                <td className="border border-black px-1"></td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* === TOTALS ROW === */}
        <div className="flex gap-6 mb-4 text-[9pt] print:text-[9pt]" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
          <span className="font-bold">Totals:</span>
          <span className="border-b border-black min-w-[4rem] px-2">Made: ______</span>
          <span className="border-b border-black min-w-[4rem] px-2">Missed: ______</span>
          <span className="border-b border-black min-w-[4rem] px-2">Blocked: ______</span>
          <span className="border-b border-black min-w-[4rem] px-2">FG%: ______</span>
        </div>

        {/* === GOALPOST DIAGRAM + LEGEND === */}
        <div className="flex gap-6 text-[9pt] print:text-[9pt]" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
          {/* Goalpost diagram */}
          <div className="border border-black p-2 flex-shrink-0">
            <p className="text-center font-bold text-[8pt] mb-1">Landing Zone Map</p>
            <svg viewBox="0 0 160 140" className="w-40 print:w-40" style={{ maxWidth: '160px' }}>
              {/* Uprights */}
              <line x1="50" y1="10" x2="50" y2="140" stroke="black" strokeWidth="2" />
              <line x1="110" y1="10" x2="110" y2="140" stroke="black" strokeWidth="2" />
              {/* Crossbar */}
              <line x1="40" y1="40" x2="120" y2="40" stroke="black" strokeWidth="2" />
              {/* Base */}
              <line x1="30" y1="140" x2="130" y2="140" stroke="black" strokeWidth="1" />
              {/* Center hash marks */}
              {[60, 80, 100, 120].map((y) => (
                <line key={y} x1="74" y1={y} x2="86" y2={y} stroke="black" strokeWidth="0.5" strokeDasharray="2,2" />
              ))}
              {/* Numbered dots for landing spots */}
              {Array.from({ length: 25 }, (_, i) => {
                // Arrange 25 dots in a 5x5 grid within the goalpost area
                const col = i % 5;
                const row = Math.floor(i / 5);
                const cx = 52 + col * 14;
                const cy = 15 + row * 25;
                return (
                  <g key={i}>
                    <circle cx={cx} cy={cy} r="3" fill="white" stroke="black" strokeWidth="0.5" />
                    <text x={cx} y={cy + 1} textAnchor="middle" fontSize="4" fill="black">{i + 1}</text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Legend */}
          <div className="text-[8pt] print:text-[8pt] space-y-1">
            <p className="font-bold text-[9pt]">Legend</p>
            <p><strong>Hash:</strong> LH = Left Hash &nbsp; LM = Left Middle &nbsp; M = Middle &nbsp; RM = Right Middle &nbsp; RH = Right Hash</p>
            <p><strong>Result:</strong> M = Made &nbsp; X = Missed &nbsp; B = Blocked</p>
            <p><strong>Miss Dir:</strong> S = Short &nbsp; WL = Wide Left &nbsp; WR = Wide Right &nbsp; CB = Crossbar</p>
            <p><strong>Rotation:</strong> G = Good &nbsp; O = Okay &nbsp; B = Bad</p>
            <p><strong>Snap/Hold:</strong> Rate 1 (poor) to 5 (excellent)</p>
            <p><strong>Op Time:</strong> Snap-to-kick time in seconds</p>
            <p><strong>LZ:</strong> Landing zone number (match to map above)</p>
            <div className="mt-2 text-gray-600 italic">
              <p>KickIQ &mdash; kickiq.com</p>
              <p>© {new Date().getFullYear()} KickIQ. For team use only.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Print-only styles */}
      <style>{`
        @media print {
          @page {
            size: letter landscape;
            margin: 0.4in;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print {
            display: none !important;
          }
          .print-sheet {
            max-width: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          input, select {
            border-bottom-style: dotted !important;
            background: transparent !important;
            color: black !important;
            -webkit-appearance: none;
          }
          input[type="date"]::-webkit-calendar-picker-indicator {
            display: none;
          }
          /* Hide placeholder text when printing */
          input::placeholder {
            color: transparent !important;
          }
        }
        @media screen {
          .print-sheet {
            background: white;
            padding: 1rem;
          }
          .print-sheet input,
          .print-sheet select {
            background: #fafafa;
          }
        }
      `}</style>
    </>
  );
}
