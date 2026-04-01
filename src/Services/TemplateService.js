import { Liquid } from 'liquidjs';

export class TemplateService {
    static Init() {
        this.engine = this.GetEngine();
    }

    static GetEngine() {
        this.engine = new Liquid({
            root: '/',
            extname: '.html',          // extension used for layouts/includes (.html) templates
            preserveTimezones: true    // keep date strings as-is, no UTC conversion
        });

        this.engine.registerFilter('mp_currency', (value) => {
            return '$' + parseFloat(value).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
          });

        // Override the default date filter to prevent timezone conversion.
        // API returns dates like "2026-04-02T09:30:00" (no TZ suffix = local time),
        // but JS Date() treats these as local then LiquidJS formats in UTC, causing offset.
        // This parses the ISO components directly so 09:30 stays 09:30.
        this.engine.registerFilter('date', (value, format) => {
            if (!value || !format) return value;
            const s = String(value);
            const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
            if (!m) return value;

            const [, yr, mo, dy, hr, mi] = m.map(Number);

            const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
            const DAYS_S = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
            const MONTHS = ['January','February','March','April','May','June',
                            'July','August','September','October','November','December'];
            const MONTHS_S = ['Jan','Feb','Mar','Apr','May','Jun',
                              'Jul','Aug','Sep','Oct','Nov','Dec'];

            // Build a Date only for day-of-week calc (components are correct, only need .getDay())
            const d = new Date(yr, mo - 1, dy);

            const hour12 = hr % 12 || 12;
            const ampm = hr < 12 ? 'AM' : 'PM';

            return format
                .replace('%-l', String(hour12))
                .replace('%l', String(hour12).padStart(2, ' '))
                .replace('%M', String(mi).padStart(2, '0'))
                .replace('%p', ampm)
                .replace('%A', DAYS[d.getDay()])
                .replace('%a', DAYS_S[d.getDay()])
                .replace('%B', MONTHS[mo - 1])
                .replace('%b', MONTHS_S[mo - 1])
                .replace('%-d', String(dy))
                .replace('%d', String(dy).padStart(2, '0'))
                .replace('%Y', String(yr))
                .replace('%m', String(mo).padStart(2, '0'));
        });

        return this.engine;
    }

    static async GetRenderedTemplate(templateName, data) {

        if (!this.engine) {
            this.Init();
        }

        return await this.engine.renderFile(templateName, data)
    }

    static async GetRenderedTemplateString(templateString, data) {

        if (!this.engine) {
            this.Init();
        }

        return await this.engine.parseAndRender(templateString, data)
    }
}