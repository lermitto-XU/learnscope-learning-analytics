import { init, use } from "echarts/core";
import { LineChart, BarChart, PieChart, RadarChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  GraphicComponent,
  RadarComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
use([
  LineChart,
  BarChart,
  PieChart,
  RadarChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  GraphicComponent,
  RadarComponent,
  CanvasRenderer,
]);
export { init };
