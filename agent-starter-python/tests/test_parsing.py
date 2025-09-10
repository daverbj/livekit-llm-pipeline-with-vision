#!/usr/bin/env python3

import sys
import re
import json
sys.path.append('src')

def parse_mistral_function_calls(content: str) -> list:
    """
    Parse Mistral-style function calls from text content.
    Expected format: [TOOL_CALLS][{"name": "function_name", "arguments": {...}}]
    """
    try:
        print(f"Parsing content: {repr(content)}")
        
        # Look for [TOOL_CALLS] followed by JSON
        pattern = r'\[TOOL_CALLS\]\s*(\[.*?\])'
        match = re.search(pattern, content, re.DOTALL)
        
        if match:
            json_str = match.group(1)
            print(f"Found JSON string: {repr(json_str)}")
            function_calls = json.loads(json_str)
            return function_calls if isinstance(function_calls, list) else [function_calls]
        else:
            print("No match found with array pattern, trying object pattern...")
            # Try single object pattern
            pattern2 = r'\[TOOL_CALLS\]\s*(\{.*?\})'
            match2 = re.search(pattern2, content, re.DOTALL)
            if match2:
                json_str = match2.group(1)
                print(f"Found JSON object: {repr(json_str)}")
                function_call = json.loads(json_str)
                return [function_call]
    except (json.JSONDecodeError, AttributeError) as e:
        print(f"Failed to parse Mistral function calls from content: {content[:100]}..., error: {e}")
    
    return []

def test_parsing():
    """Test the parsing function with sample data"""
    
    # Test data from the raw output
    test_content = '[TOOL_CALLS][{"name": "get_weather", "arguments": {"city": "New York", "unit": "fahrenheit"}}]'
    
    print("Testing Mistral function call parsing...")
    print(f"Test content: {test_content}")
    print()
    
    result = parse_mistral_function_calls(test_content)
    print(f"Parse result: {result}")
    
    if result:
        for i, func_call in enumerate(result):
            print(f"  Function {i+1}:")
            print(f"    Name: {func_call.get('name')}")
            print(f"    Arguments: {func_call.get('arguments')}")

if __name__ == "__main__":
    test_parsing()
