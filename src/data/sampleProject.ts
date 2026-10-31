/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DwinProject } from '../types/dwin';
import industrialDashboardImg from '../assets/images/dwin_hmi_industrial_dashboard_1793218798770.jpg';
import blueprintPanelImg from '../assets/images/dwin_hmi_blueprint_panel_1793218820640.jpg';

export const initialDwinProject: DwinProject = {
  id: 'proj_chamber_x600',
  name: 'ChamberMaster X600 Thermal Test Rig',
  version: '2.4.0',
  description: 'Industrial Environmental Chamber DGUS HMI - Multi-zone thermal cycling, PID loop telemetry, and safety lockouts.',
  dwinModel: 'DMG80480C070_03WTC (T5L2 ASIC - 800x480 Capacitive Touch)',
  resolution: '800x480',
  headerHex: '5A A5',
  updatedAt: new Date().toISOString(),
  screens: [
    {
      id: 'scr_0',
      screenNumber: 0,
      name: 'Main Operations Dashboard',
      group: 'Operator UI',
      resolution: '800x480',
      bgImageIndex: 0,
      bgImageUrl: industrialDashboardImg,
      description: 'Primary real-time telemetry console showing live temperatures, motor RPM, chamber barometric pressure, and cycle run/stop status.',
      vpBindings: [
        {
          id: 'b_0_1',
          vpAddress: 0x1000,
          role: 'data_display',
          label: 'Target Temperature Display (32-bit)',
          x: 180,
          y: 110,
          width: 140,
          height: 48,
          notes: '4-byte UINT32 value. Writes 0x000186A0 for 100,000 (100.0 °C)'
        },
        {
          id: 'b_0_2',
          vpAddress: 0x1002,
          role: 'data_display',
          label: 'Chamber Live Temperature',
          x: 340,
          y: 110,
          width: 140,
          height: 48
        },
        {
          id: 'b_0_3',
          vpAddress: 0x1010,
          role: 'data_display',
          label: 'Circulation Motor RPM',
          x: 180,
          y: 180,
          width: 140,
          height: 48
        },
        {
          id: 'b_0_4',
          vpAddress: 0x1014,
          role: 'data_display',
          label: 'Chamber Pressure (bar)',
          x: 340,
          y: 180,
          width: 140,
          height: 48
        },
        {
          id: 'b_0_5',
          vpAddress: 0x1020,
          role: 'status_icon',
          label: 'Run / Standby State Indicator',
          x: 520,
          y: 110,
          width: 120,
          height: 60
        }
      ],
      navigations: [
        {
          id: 'nav_0_1',
          targetScreenNumber: 1,
          trigger: 'touch_button',
          buttonLabel: 'Settings & Config',
          description: 'Navigates to hardware configuration screen'
        },
        {
          id: 'nav_0_2',
          targetScreenNumber: 2,
          trigger: 'touch_button',
          buttonLabel: 'PID Tuning',
          description: 'Opens closed-loop temperature tuning matrix'
        },
        {
          id: 'nav_0_3',
          targetScreenNumber: 3,
          trigger: 'alarm_jump',
          buttonLabel: 'Alarm Log',
          description: 'Auto-jumps when Active_Fault_Bits (0x1060) is non-zero'
        }
      ],
      updatedAt: new Date().toISOString()
    },
    {
      id: 'scr_1',
      screenNumber: 1,
      name: 'System Parameters & Setpoints',
      group: 'Settings',
      resolution: '800x480',
      bgImageIndex: 1,
      bgImageUrl: blueprintPanelImg,
      description: 'Setup panel for over-temperature trip points, cooling fan PWM speed, cycle timer duration, and display language.',
      vpBindings: [
        {
          id: 'b_1_1',
          vpAddress: 0x1004,
          role: 'touch_input',
          label: 'Over-Temperature Safety Trip (°C)',
          x: 160,
          y: 120,
          width: 180,
          height: 44
        },
        {
          id: 'b_1_2',
          vpAddress: 0x1012,
          role: 'slider_control',
          label: 'Cooling Fan Speed PWM (%)',
          x: 160,
          y: 180,
          width: 240,
          height: 44
        },
        {
          id: 'b_1_3',
          vpAddress: 0x1030,
          role: 'touch_input',
          label: 'Target Cycle Duration (s)',
          x: 160,
          y: 240,
          width: 180,
          height: 44
        },
        {
          id: 'b_1_4',
          vpAddress: 0x1050,
          role: 'touch_input',
          label: 'HMI Language Select',
          x: 160,
          y: 300,
          width: 180,
          height: 44
        }
      ],
      navigations: [
        {
          id: 'nav_1_0',
          targetScreenNumber: 0,
          trigger: 'return_prev',
          buttonLabel: 'Back to Home',
          description: 'Returns to Main Operations Dashboard'
        },
        {
          id: 'nav_1_4',
          targetScreenNumber: 4,
          trigger: 'touch_button',
          buttonLabel: 'Actuator Diagnostics',
          description: 'Access manual solenoid and relay test modes'
        }
      ],
      updatedAt: new Date().toISOString()
    },
    {
      id: 'scr_2',
      screenNumber: 2,
      name: 'Closed-Loop PID Tuning',
      group: 'Engineering',
      resolution: '800x480',
      bgImageIndex: 2,
      bgImageUrl: industrialDashboardImg,
      description: 'Direct adjustment of heating/chilling loop gain constants Kp, Ki, and Kd with live setpoint reference.',
      vpBindings: [
        {
          id: 'b_2_1',
          vpAddress: 0x1040,
          role: 'touch_input',
          label: 'Proportional Gain Kp',
          x: 140,
          y: 110,
          width: 160,
          height: 44
        },
        {
          id: 'b_2_2',
          vpAddress: 0x1042,
          role: 'touch_input',
          label: 'Integral Gain Ki',
          x: 140,
          y: 170,
          width: 160,
          height: 44
        },
        {
          id: 'b_2_3',
          vpAddress: 0x1044,
          role: 'touch_input',
          label: 'Derivative Gain Kd',
          x: 140,
          y: 230,
          width: 160,
          height: 44
        },
        {
          id: 'b_2_4',
          vpAddress: 0x1000,
          role: 'data_display',
          label: 'Reference Setpoint Temp',
          x: 340,
          y: 110,
          width: 160,
          height: 44
        }
      ],
      navigations: [
        {
          id: 'nav_2_0',
          targetScreenNumber: 0,
          trigger: 'return_prev',
          buttonLabel: 'Back to Home',
          description: 'Exit PID screen'
        }
      ],
      updatedAt: new Date().toISOString()
    },
    {
      id: 'scr_3',
      screenNumber: 3,
      name: 'Alarm Matrix & Fault History',
      group: 'Safety',
      resolution: '800x480',
      bgImageIndex: 3,
      bgImageUrl: blueprintPanelImg,
      description: 'Active hardware interlocks, over-pressure trips, emergency stop status, and trip event log.',
      vpBindings: [
        {
          id: 'b_3_1',
          vpAddress: 0x1060,
          role: 'status_icon',
          label: 'Active Fault Bitfield Register',
          x: 120,
          y: 110,
          width: 260,
          height: 52
        },
        {
          id: 'b_3_2',
          vpAddress: 0x1062,
          role: 'data_display',
          label: 'Lifetime Safety Trip Counter',
          x: 120,
          y: 180,
          width: 160,
          height: 44
        }
      ],
      navigations: [
        {
          id: 'nav_3_0',
          targetScreenNumber: 0,
          trigger: 'return_prev',
          buttonLabel: 'Acknowledge & Return',
          description: 'Acknowledge fault and return to Home'
        }
      ],
      updatedAt: new Date().toISOString()
    },
    {
      id: 'scr_4',
      screenNumber: 4,
      name: 'Pneumatic & Actuator Diagnostics',
      group: 'Diagnostics',
      resolution: '800x480',
      bgImageIndex: 4,
      bgImageUrl: industrialDashboardImg,
      description: 'Manual toggle overrides for solenoid bypass valve and variable compressor pulse-width duty.',
      vpBindings: [
        {
          id: 'b_4_1',
          vpAddress: 0x1070,
          role: 'touch_input',
          label: 'Purge Valve Solenoid State',
          x: 140,
          y: 120,
          width: 180,
          height: 44
        },
        {
          id: 'b_4_2',
          vpAddress: 0x1072,
          role: 'slider_control',
          label: 'Inverter Compressor Duty (%)',
          x: 140,
          y: 180,
          width: 220,
          height: 44
        }
      ],
      navigations: [
        {
          id: 'nav_4_1',
          targetScreenNumber: 1,
          trigger: 'return_prev',
          buttonLabel: 'Back to Settings',
          description: 'Return to Settings'
        },
        {
          id: 'nav_4_0',
          targetScreenNumber: 0,
          trigger: 'touch_button',
          buttonLabel: 'Home Screen',
          description: 'Jump to Main Screen'
        }
      ],
      updatedAt: new Date().toISOString()
    },
    {
      id: 'scr_5',
      screenNumber: 5,
      name: 'Emergency Thermal Cutout Overlay',
      group: 'Safety',
      resolution: '800x480',
      bgImageIndex: 5,
      bgImageUrl: blueprintPanelImg,
      description: 'Hardware safety overlay engaged when over-temperature limit is exceeded. Requires physical interlock reset.',
      vpBindings: [
        {
          id: 'b_5_1',
          vpAddress: 0x1002,
          role: 'data_display',
          label: 'Critical Chamber Temperature',
          x: 200,
          y: 140,
          width: 200,
          height: 50
        },
        {
          id: 'b_5_2',
          vpAddress: 0x1060,
          role: 'status_icon',
          label: 'Emergency Interlock Bitmask',
          x: 200,
          y: 210,
          width: 200,
          height: 50
        }
      ],
      navigations: [
        {
          id: 'nav_5_0',
          targetScreenNumber: 0,
          trigger: 'touch_button',
          buttonLabel: 'Reset Interlock & Home',
          description: 'Clears safety latch if temperatures are below threshold'
        }
      ],
      updatedAt: new Date().toISOString()
    }
  ],
  parameters: [
    {
      id: 'param_target_temp',
      name: 'Target Temperature',
      identifier: 'CMD_TARGET_TEMP',
      vpAddress: 0x1000,
      dataType: 'UINT32',
      words: 2,
      unit: '°C',
      scale: 10,
      min: 0,
      max: 100000,
      defaultValue: 0,
      role: 'read_write',
      group: 'Thermal Loop',
      description: '4-byte payload temperature setpoint. Real-time telemetry starts at 0x00000000 (0.0 °C). Stored across VP 0x1000 and 0x1001.',
      updatedAt: new Date().toISOString()
    },
    {
      id: 'param_chamber_temp',
      name: 'Chamber Live Temperature',
      identifier: 'TELEMETRY_CHAMBER_TEMP',
      vpAddress: 0x1002,
      dataType: 'INT16',
      words: 1,
      unit: '°C',
      scale: 10,
      min: -500,
      max: 2500,
      defaultValue: 248,
      role: 'read_only',
      group: 'Thermal Loop',
      description: 'Real-time PT100 RTD sensor measurement. 248 = 24.8 °C. Signed integer to support cryogenic sub-zero cycles.',
      updatedAt: new Date().toISOString()
    },
    {
      id: 'param_overtemp_limit',
      name: 'Over-Temperature Safety Trip',
      identifier: 'CFG_OVERTEMP_LIMIT',
      vpAddress: 0x1004,
      dataType: 'UINT16',
      words: 1,
      unit: '°C',
      scale: 10,
      min: 500,
      max: 3000,
      defaultValue: 1800,
      role: 'read_write',
      group: 'Safety',
      description: 'Hardware safety threshold. If chamber temp exceeds this value, emergency cutout screen (Screen 5) triggers immediately.',
      updatedAt: new Date().toISOString()
    },
    {
      id: 'param_motor_rpm',
      name: 'Circulation Blower RPM',
      identifier: 'CMD_MOTOR_RPM',
      vpAddress: 0x1010,
      dataType: 'UINT32',
      words: 2,
      unit: 'RPM',
      scale: 1,
      min: 0,
      max: 12000,
      defaultValue: 3600,
      role: 'read_write',
      group: 'Motion Control',
      description: 'Brushless DC blower velocity setpoint. Uses 2 words (VP 0x1010 & 0x1011).',
      updatedAt: new Date().toISOString()
    },
    {
      id: 'param_fan_pwm',
      name: 'Condenser Fan Speed PWM',
      identifier: 'CMD_FAN_PWM',
      vpAddress: 0x1012,
      dataType: 'UINT16',
      words: 1,
      unit: '%',
      scale: 1,
      min: 0,
      max: 100,
      defaultValue: 75,
      role: 'read_write',
      group: 'Thermal Loop',
      description: 'Auxiliary cooling stage radiator fan duty cycle from 0 to 100%.',
      updatedAt: new Date().toISOString()
    },
    {
      id: 'param_chamber_press',
      name: 'Chamber Pressure Sensor',
      identifier: 'TELEMETRY_PRESSURE_BAR',
      vpAddress: 0x1014,
      dataType: 'FLOAT32',
      words: 2,
      unit: 'bar',
      scale: 1,
      min: 0,
      max: 16.0,
      defaultValue: 1.013,
      role: 'read_only',
      group: 'Pneumatics',
      description: 'Barometric / gauge pressure reading. Big-endian IEEE-754 32-bit floating point format (VP 0x1014 & 0x1015).',
      updatedAt: new Date().toISOString()
    },
    {
      id: 'param_system_state',
      name: 'System Execution State',
      identifier: 'SYS_EXEC_STATE',
      vpAddress: 0x1020,
      dataType: 'UINT16',
      words: 1,
      unit: 'enum',
      scale: 1,
      min: 0,
      max: 5,
      defaultValue: 1,
      role: 'read_write',
      group: 'System',
      description: '0=Off, 1=Idle/Standby, 2=Heating, 3=Soaking, 4=Cooling, 5=Fault Lockout.',
      updatedAt: new Date().toISOString()
    },
    {
      id: 'param_cycle_timer',
      name: 'Test Cycle Duration',
      identifier: 'CFG_CYCLE_DURATION_SEC',
      vpAddress: 0x1030,
      dataType: 'UINT32',
      words: 2,
      unit: 's',
      scale: 1,
      min: 10,
      max: 864000,
      defaultValue: 3600,
      role: 'read_write',
      group: 'Testing',
      description: 'Total automated profile soak time in seconds.',
      updatedAt: new Date().toISOString()
    },
    {
      id: 'param_pid_kp',
      name: 'PID Proportional Constant (Kp)',
      identifier: 'PID_GAIN_KP',
      vpAddress: 0x1040,
      dataType: 'UINT16',
      words: 1,
      unit: 'gain',
      scale: 100,
      min: 0,
      max: 5000,
      defaultValue: 250,
      role: 'read_write',
      group: 'Engineering',
      description: 'Proportional loop term. 250 = 2.50.',
      updatedAt: new Date().toISOString()
    },
    {
      id: 'param_pid_ki',
      name: 'PID Integral Constant (Ki)',
      identifier: 'PID_GAIN_KI',
      vpAddress: 0x1042,
      dataType: 'UINT16',
      words: 1,
      unit: 'gain',
      scale: 100,
      min: 0,
      max: 5000,
      defaultValue: 45,
      role: 'read_write',
      group: 'Engineering',
      description: 'Integral reset rate. 45 = 0.45.',
      updatedAt: new Date().toISOString()
    },
    {
      id: 'param_pid_kd',
      name: 'PID Derivative Constant (Kd)',
      identifier: 'PID_GAIN_KD',
      vpAddress: 0x1044,
      dataType: 'UINT16',
      words: 1,
      unit: 'gain',
      scale: 100,
      min: 0,
      max: 5000,
      defaultValue: 15,
      role: 'read_write',
      group: 'Engineering',
      description: 'Derivative damping term. 15 = 0.15.',
      updatedAt: new Date().toISOString()
    },
    {
      id: 'param_language',
      name: 'UI Language Select',
      identifier: 'CFG_UI_LANGUAGE',
      vpAddress: 0x1050,
      dataType: 'UINT16',
      words: 1,
      unit: 'id',
      scale: 1,
      min: 0,
      max: 3,
      defaultValue: 0,
      role: 'read_write',
      group: 'System',
      description: '0=English, 1=German, 2=Chinese Simplified, 3=Spanish.',
      updatedAt: new Date().toISOString()
    },
    {
      id: 'param_fault_bits',
      name: 'Active Fault Bitfield',
      identifier: 'ALARM_ACTIVE_BITS',
      vpAddress: 0x1060,
      dataType: 'BITFIELD',
      words: 1,
      unit: 'flags',
      scale: 1,
      min: 0,
      max: 65535,
      defaultValue: 0,
      role: 'read_only',
      group: 'Safety',
      description: 'Bit 0: E-Stop Pressed, Bit 1: Chamber Door Open, Bit 2: Over-Temp Cutout, Bit 3: Motor Stall, Bit 4: Pressure Relief.',
      updatedAt: new Date().toISOString()
    },
    {
      id: 'param_trip_counter',
      name: 'Lifetime Safety Trip Counter',
      identifier: 'HIST_TRIP_COUNT',
      vpAddress: 0x1062,
      dataType: 'UINT16',
      words: 1,
      unit: 'events',
      scale: 1,
      min: 0,
      max: 65535,
      defaultValue: 3,
      role: 'read_only',
      group: 'Safety',
      description: 'Non-volatile counter recording number of safety trips.',
      updatedAt: new Date().toISOString()
    },
    {
      id: 'param_valve_solenoid',
      name: 'Pressure Relief Solenoid',
      identifier: 'ACT_VALVE_PURGE',
      vpAddress: 0x1070,
      dataType: 'UINT16',
      words: 1,
      unit: 'state',
      scale: 1,
      min: 0,
      max: 1,
      defaultValue: 0,
      role: 'read_write',
      group: 'Pneumatics',
      description: '0 = Closed (pressurized), 1 = Energized Open (vent to atmosphere).',
      updatedAt: new Date().toISOString()
    },
    {
      id: 'param_compressor_duty',
      name: 'Inverter Compressor Duty',
      identifier: 'ACT_COMPRESSOR_PWM',
      vpAddress: 0x1072,
      dataType: 'UINT16',
      words: 1,
      unit: '%',
      scale: 1,
      min: 0,
      max: 100,
      defaultValue: 40,
      role: 'read_write',
      group: 'Thermal Loop',
      description: 'Direct inverter compressor speed control modulation.',
      updatedAt: new Date().toISOString()
    }
  ]
};
