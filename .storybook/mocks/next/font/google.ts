type FontOptions = {
  variable?: string;
};

type FontInstance = {
  className: string;
  style: { fontFamily: string };
  variable: string;
};

function createFontFactory(fontFamily: string, defaultVariable: string) {
  return (options: FontOptions = {}): FontInstance => {
    const variable = options.variable ?? defaultVariable;
    return {
      className: `sb-font-${fontFamily.toLowerCase().replace(/\s+/g, '-')}`,
      style: { fontFamily: `"${fontFamily}", sans-serif` },
      variable,
    };
  };
}

export const Inter = createFontFactory('Inter', '--font-inter');
export const Noto_Sans_KR = createFontFactory(
  'Noto Sans KR',
  '--font-noto-sans-kr'
);
